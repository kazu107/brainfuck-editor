(function () {
    const MEMORY_ROWS = 256; // 00-FF
    const MEMORY_COLS = 16; // 0-F
    const MEMORY_SIZE = MEMORY_ROWS * MEMORY_COLS; // 4096 bytes

    const memory = new Uint8Array(MEMORY_SIZE);

    const codeTextarea = document.getElementById("code");
    const inputEl = document.getElementById("input");
    const outputEl = document.getElementById("output");
    const runBtn = document.getElementById("run-btn");
    const stepBtn = document.getElementById("step-btn");
    const resetBtn = document.getElementById("reset-btn");
    const eofSelect = document.getElementById("eof-behavior");
    const maxStepsInput = document.getElementById("max-steps");
    const executionSpeedInput = document.getElementById("execution-speed");
    const instantRunCheckbox = document.getElementById("instant-run");
    const memoryTable = document.getElementById("memory-table");
    const asciiTableBody = document.querySelector("#ascii-table tbody");
    const memoryFormatToggle = document.getElementById("memory-format-toggle");
    const editorTabsContainer = document.getElementById("editor-tabs");
    const addTabBtn = document.getElementById("add-tab-btn");

    let tabs = [
        { name: "main.bf", code: "" },
        { name: "buffer.bf", code: "" },
        { name: "playground.bf", code: "" }
    ];
    let activeTabIndex = 0;
    let memoryFormat = "hex";

    const codeEditor = CodeMirror.fromTextArea(codeTextarea, {
        lineNumbers: true,
        mode: "text/x-brainfuck",
        theme: "dracula",
        lineWrapping: true
    });

    let pointer = 0;
    let lastPointerCellId = null;
    let lastHighlight = null;
    let executionState = null;
    let isRunning = false;

    function buildMemoryTable() {
        const thead = document.createElement("thead");
        const headerRow = document.createElement("tr");

        const corner = document.createElement("th");
        corner.textContent = "";
        headerRow.appendChild(corner);

        for (let col = 0; col < MEMORY_COLS; col++) {
            const th = document.createElement("th");
            th.textContent = col.toString(16).toUpperCase();
            headerRow.appendChild(th);
        }

        thead.appendChild(headerRow);
        memoryTable.appendChild(thead);

        const tbody = document.createElement("tbody");

        for (let row = 0; row < MEMORY_ROWS; row++) {
            const tr = document.createElement("tr");

            const rowHeader = document.createElement("th");
            rowHeader.textContent = row.toString(16).toUpperCase().padStart(2, "0");
            rowHeader.className = "row-header";
            tr.appendChild(rowHeader);

            for (let col = 0; col < MEMORY_COLS; col++) {
                const td = document.createElement("td");
                const index = row * MEMORY_COLS + col;
                td.id = "cell-" + index;
                td.textContent = "00";
                tr.appendChild(td);
            }

            tbody.appendChild(tr);
        }

        memoryTable.appendChild(tbody);
    }

    function buildAsciiTable() {
        if (!asciiTableBody) return;

        for (let code = 32; code <= 126; code++) {
            const tr = document.createElement("tr");

            const decTd = document.createElement("td");
            decTd.textContent = String(code);

            const hexTd = document.createElement("td");
            hexTd.textContent = code.toString(16).toUpperCase().padStart(2, "0");

            const charTd = document.createElement("td");
            let ch = String.fromCharCode(code);

            if (ch === " ") ch = "SPC";
            if (ch === "<") ch = "&lt;";
            if (ch === ">") ch = "&gt;";
            if (ch === "&") ch = "&amp;";

            charTd.innerHTML = ch;

            tr.appendChild(decTd);
            tr.appendChild(hexTd);
            tr.appendChild(charTd);

            asciiTableBody.appendChild(tr);
        }
    }

    function resetMemory() {
        memory.fill(0);
        pointer = 0;
        updateMemoryView();
    }

    function updateMemoryView() {
        for (let i = 0; i < MEMORY_SIZE; i++) {
            const td = document.getElementById("cell-" + i);
            if (!td) continue;
            const value = memory[i];
            const text =
                memoryFormat === "hex"
                    ? value.toString(16).toUpperCase().padStart(2, "0")
                    : String(value);
            td.textContent = text;
            td.classList.remove("current-pointer");
        }

        if (lastPointerCellId !== null) {
            const old = document.getElementById(lastPointerCellId);
            if (old) old.classList.remove("current-pointer");
        }

        const cellId = "cell-" + pointer;
        const currentCell = document.getElementById(cellId);
        if (currentCell) {
            currentCell.classList.add("current-pointer");
            lastPointerCellId = cellId;
            currentCell.scrollIntoView({ block: "nearest", inline: "nearest" });
        }
    }

    function clearOutput() {
        outputEl.textContent = "";
    }

    function writeOutput(text) {
        outputEl.textContent += text;
    }

    function clearHighlight() {
        if (lastHighlight) {
            lastHighlight.clear();
            lastHighlight = null;
        }
    }

    function highlightRange(startIndex, endIndexExclusive) {
        clearHighlight();
        if (!codeEditor || startIndex == null || endIndexExclusive == null) return;
        const from = codeEditor.posFromIndex(startIndex);
        const to = codeEditor.posFromIndex(endIndexExclusive);
        lastHighlight = codeEditor.markText(from, to, { className: "cm-current-instruction" });
    }

    function buildBracketMap(code) {
        const map = {};
        const stack = [];

        for (let i = 0; i < code.length; i++) {
            const c = code[i];
            if (c === "[") {
                stack.push(i);
            } else if (c === "]") {
                if (stack.length === 0) {
                    alert('Found "]" without matching "[" (position: ' + i + ")");
                    return null;
                }
                const openIndex = stack.pop();
                map[openIndex] = i;
                map[i] = openIndex;
            }
        }

        if (stack.length > 0) {
            const openIndex = stack.pop();
            alert('Found "[" without matching "]" (position: ' + openIndex + ")");
            return null;
        }

        return map;
    }

    function filterBrainfuckCode(raw) {
        let result = "";
        const mapping = [];
        const valid = "+-<>[].,";
        for (let i = 0; i < raw.length; i++) {
            const ch = raw[i];
            if (valid.includes(ch)) {
                result += ch;
                mapping.push(i);
            }
        }
        return { code: result, mapping };
    }

    function prepareExecutionState() {
        const rawCode = codeEditor ? codeEditor.getValue() : codeTextarea.value || "";
        tabs[activeTabIndex].code = rawCode;
        const filtered = filterBrainfuckCode(rawCode);
        const code = filtered.code;
        if (code.length === 0) {
            alert("Brainfuck code is empty or contains no Brainfuck symbols.");
            return null;
        }

        const bracketMap = buildBracketMap(code);
        if (!bracketMap) return null;

        resetMemory();
        clearOutput();
        clearHighlight();

        return {
            rawCode,
            code,
            mapping: filtered.mapping,
            bracketMap,
            ip: 0,
            input: inputEl.value || "",
            inputIndex: 0,
            maxSteps: Math.max(1, parseInt(maxStepsInput.value, 10) || 1000000),
            steps: 0,
            eofBehavior: eofSelect.value,
            finished: false
        };
    }

    function markInstruction(state, startIp, span) {
        if (!state || !state.mapping || state.mapping.length === 0) return;
        const start = state.mapping[startIp];
        const end = state.mapping[startIp + span - 1] + 1;
        highlightRange(start, end);
    }

    function stepExecution(state, shouldHighlight = true) {
        if (!state || state.finished) return { done: true };
        if (state.steps >= state.maxSteps) {
            writeOutput(
                "\n[Stopped] Exceeded max steps (" + state.maxSteps + "). Possible infinite loop."
            );
            state.finished = true;
            clearHighlight();
            return { done: true };
        }

        if (state.ip >= state.code.length) {
            state.finished = true;
            clearHighlight();
            return { done: true };
        }

        const cmd = state.code[state.ip];
        let span = 1;
        if (cmd === "+" || cmd === "-") {
            let j = state.ip + 1;
            while (j < state.code.length && state.code[j] === cmd) {
                j++;
            }
            span = j - state.ip;
        }

        if (shouldHighlight) {
            markInstruction(state, state.ip, span);
        }

        switch (cmd) {
            case ">":
                pointer = pointer + 1;
                if (pointer >= MEMORY_SIZE) pointer = 0;
                state.ip += 1;
                break;
            case "<":
                pointer = pointer - 1;
                if (pointer < 0) pointer = MEMORY_SIZE - 1;
                state.ip += 1;
                break;
            case "+":
                memory[pointer] = (memory[pointer] + span) & 0xff;
                state.ip += span;
                break;
            case "-":
                memory[pointer] = (memory[pointer] - span + 256 * span) & 0xff;
                state.ip += span;
                break;
            case ".":
                writeOutput(String.fromCharCode(memory[pointer]));
                state.ip += 1;
                break;
            case ",":
                if (state.inputIndex < state.input.length) {
                    memory[pointer] = state.input.charCodeAt(state.inputIndex++) & 0xff;
                } else if (state.eofBehavior === "zero") {
                    memory[pointer] = 0;
                } else if (state.eofBehavior === "minusOne") {
                    memory[pointer] = 255;
                }
                state.ip += 1;
                break;
            case "[":
                if (memory[pointer] === 0) {
                    state.ip = state.bracketMap[state.ip] + 1;
                } else {
                    state.ip += 1;
                }
                break;
            case "]":
                if (memory[pointer] !== 0) {
                    state.ip = state.bracketMap[state.ip] + 1;
                } else {
                    state.ip += 1;
                }
                break;
            default:
                state.ip += 1;
                break;
        }

        state.steps += 1;

        if (state.ip >= state.code.length) {
            state.finished = true;
            if (shouldHighlight) clearHighlight();
        }

        return { done: state.finished };
    }

    function runStep() {
        if (isRunning) return;
        if (!executionState || executionState.finished) {
            executionState = prepareExecutionState();
            if (!executionState) return;
        }
        const result = stepExecution(executionState, true);
        updateMemoryView();
        if (result && result.done) {
            isRunning = false;
        }
    }

    function resolveDelay() {
        const speedValue = executionSpeedInput ? parseInt(executionSpeedInput.value, 10) : 0;
        return Math.max(0, Number.isFinite(speedValue) ? speedValue : 0);
    }

    function runContinuously() {
        if (isRunning) return;
        executionState = prepareExecutionState();
        if (!executionState) return;

        const instant = instantRunCheckbox && instantRunCheckbox.checked;
        const initialDelay = resolveDelay();

        isRunning = true;

        if (instant || initialDelay === 0) {
            while (isRunning) {
                const result = stepExecution(executionState, false);
                if (result && result.done) {
                    isRunning = false;
                    break;
                }
            }
            updateMemoryView();
            return;
        }

        const tick = () => {
            if (!isRunning) return;
            const result = stepExecution(executionState, true);
            let done = false;
            if (result && result.done) {
                done = true;
                isRunning = false;
            }
            if (instantRunCheckbox && instantRunCheckbox.checked) {
                while (isRunning) {
                    const instantResult = stepExecution(executionState, false);
                    if (instantResult && instantResult.done) {
                        isRunning = false;
                        break;
                    }
                }
                updateMemoryView();
                return;
            }

            const delay = resolveDelay();
            const stepsPerTick =
                delay <= 100 ? Math.max(1, Math.round(100 / Math.max(delay, 1))) : 1;

            for (let i = 1; i < stepsPerTick && !done; i++) {
                const loopResult = stepExecution(executionState, false);
                if (loopResult && loopResult.done) {
                    done = true;
                    isRunning = false;
                    break;
                }
            }

            updateMemoryView();

            if (done) return;

            setTimeout(tick, delay);
        };
        tick();
    }

    function resetAll() {
        isRunning = false;
        resetMemory();
        clearOutput();
        clearHighlight();
        executionState = null;
    }

    function setSampleCode() {
        const sampleHello =
            "+++++ +++++             set cell0 to 10\n" +
            "[                       loop 10 times\n" +
            "    > +++++ ++          cell1 += 7\n" +
            "    > +++++ +++++       cell2 += 10\n" +
            "    > +++               cell3 += 3\n" +
            "    > +                 cell4 += 1\n" +
            "    <<<< -              decrement counter\n" +
            "]\n" +
            "> ++ .                  72 'H'\n" +
            "> + .                   101 'e'\n" +
            "++ .                    108 'l'\n" +
            ".                       108 'l'\n" +
            "+++ .                   111 'o'\n" +
            "> ++ .                  44 ','\n" +
            "<< +++++ +++++ +++++ .  32 ' '\n" +
            "> .                     87 'W'\n" +
            "--- .                   111 'o'\n" +
            "+++++ ++ .              114 'r'\n" +
            "----- - .               108 'l'\n" +
            "----- --- .             100 'd'\n" +
            "> +++ .                 33 '!'\n";

        const sampleEcho =
            ",[                       read 1 byte until input ends\n" +
            "    .                    echo the byte\n" +
            "    ,                    read next byte\n" +
            "]\n";

        const sampleCounter =
            "+++++ +++++             set cell0 to 10\n" +
            "[                       loop 10 times\n" +
            "    > +++++ +           add 6 to cell1 (total 60)\n" +
            "    < -                 decrement cell0\n" +
            "]\n" +
            "> +++++ .               output cell1=65 ('A')\n";

        tabs[0].code = sampleHello;
        tabs[1].code = sampleEcho;
        tabs[2].code = sampleCounter;

        if (codeEditor) {
            codeEditor.setValue(sampleHello);
        } else {
            codeTextarea.value = sampleHello;
        }
    }

    buildMemoryTable();
    buildAsciiTable();
    resetAll();
    setSampleCode();

    if (memoryFormatToggle) {
        memoryFormatToggle.addEventListener("click", () => {
            memoryFormat = memoryFormat === "hex" ? "dec" : "hex";
            memoryFormatToggle.textContent = memoryFormat === "hex" ? "Hex" : "Dec";
            memoryFormatToggle.classList.toggle("active", memoryFormat === "hex");
            updateMemoryView();
        });
    }

    function renderTabs() {
        if (!editorTabsContainer) return;
        editorTabsContainer.innerHTML = "";
        tabs.forEach((tab, idx) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "editor-tab" + (idx === activeTabIndex ? " active" : "");
            btn.dataset.index = String(idx);

            const title = document.createElement("span");
            title.className = "tab-title";
            title.textContent = tab.name;

            const renameBtn = document.createElement("span");
            renameBtn.className = "tab-rename";
            renameBtn.setAttribute("role", "button");
            renameBtn.title = "Rename tab";
            renameBtn.innerHTML =
                '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M9.9 1a1 1 0 00-.7.3L8 2.5l1.5 1.5 1.2-1.2A1 1 0 0010.2 1H9.9zm-2.5 2.2L2 8.6V10h1.4l5.4-5.4L7.4 3.2z" fill="currentColor"/></svg>';
            renameBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                renameTab(idx);
            });
            renameBtn.addEventListener("keydown", (e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    renameTab(idx);
                }
            });
            renameBtn.tabIndex = 0;

            btn.addEventListener("click", () => switchTab(idx));

            btn.appendChild(title);
            btn.appendChild(renameBtn);
            editorTabsContainer.appendChild(btn);
        });
    }

    function switchTab(index) {
        if (index === activeTabIndex || index < 0 || index >= tabs.length) return;
        const currentCode = codeEditor ? codeEditor.getValue() : codeTextarea.value || "";
        tabs[activeTabIndex].code = currentCode;
        activeTabIndex = index;
        renderTabs();
        const nextValue = tabs[activeTabIndex].code || "";
        if (codeEditor) {
            codeEditor.setValue(nextValue);
        } else {
            codeTextarea.value = nextValue;
        }
        executionState = null;
        clearHighlight();
    }

    function renameTab(index) {
        const current = tabs[index].name;
        const next = prompt("Rename tab", current);
        if (!next || next.trim() === "") return;
        tabs[index].name = next.trim();
        renderTabs();
    }

    function addTab() {
        const base = "tab";
        const nextIndex = tabs.length + 1;
        const name = base + nextIndex + ".bf";
        tabs.push({ name, code: "" });
        switchTab(tabs.length - 1);
    }

    renderTabs();

    if (addTabBtn) {
        addTabBtn.addEventListener("click", addTab);
    }

    runBtn.addEventListener("click", runContinuously);
    if (stepBtn) stepBtn.addEventListener("click", runStep);
    resetBtn.addEventListener("click", resetAll);
})();
