//@ts-check

// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.
(function () {
    // @ts-ignore
    const vscode = acquireVsCodeApi();

    // wireup event handlers
    document.querySelector('.root-folder-button')?.addEventListener('click', () => {
        vscode.postMessage({ command: 'retrace.rootFolder' });
    });

    document.querySelector('.trace-folder-button')?.addEventListener('click', () => {
        vscode.postMessage({ command: 'retrace.traceName' });
    });

    document.querySelector('.gen-config-button')?.addEventListener('click', () => {
        // get the trace config values.
        vscode.postMessage({ command: 'retrace.generateConfig', value: getConfigValues()});
    });

    // Handle messages sent from the extension to the webview
    window.addEventListener('message', event => {
        const message = event.data; // The json data that the extension sent
        switch (message.type) {
            case 'setRootFolder': {
                setRootFolder(message.path);
                break;
            }
            case 'setTraceName': {
                setTraceName(message.path);
                break;
            }
            case 'updateTraceView': {
                setRootFolder(message.value.rootPath);
                setTraceName(message.value.traceName);
                break;
            }
        }
    });
    
    // set retrace root  folder
    function setRootFolder(path) {
        console.log(`setting root folder to ${path}`);

        setInput("root-folder", path);
    }

    // set the name of the trace to debug
    function setTraceName(traceName) {
        console.log(`setting trace name to ${traceName}`);
        setInput("trace-folder", traceName);
    }

    function setInput(id, value) {
        let el = document.getElementById(id); // as HTMLInputElement;
        if (el !== null) {
            el.value = value;
        }
    }

    function getInput(id) {
        let el = document.getElementById(id); // as HTMLInputElement;
        if (el !== null) {
            return el.value;
        }

        return "";
    }

    // getConfigValues()
    function getConfigValues() {
        const rootPath = getInput("root-folder");
        const traceName = getInput("trace-folder"); // as HTMLInputElement;
        return { rootPath, traceName };
    }
}());
