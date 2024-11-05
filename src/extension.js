const vscode = require('vscode');

// need a replay selector
// thats just an open dialog for now

// set the 

// export function activate(context: vscode.ExtensionContext) {
//     let disposable = vscode.commands.registerCommand('myExtension.openView', () => {
//         vscode.window.showInformationMessage('My View Opened');
//     });

//     context.subscriptions.push(disposable);
// }

function activate(context) {
    vscode.window.showInformationMessage('Activating!!!!!');

    // vscode.window.showOpenDialog({
    //     canSelectMany: false,
    //     canSelectFiles: true,
    //     canSelectFolders: false,
    //     openLabel: 'Select a file'
    // }).then(fileUri => {
    //     if (fileUri && fileUri[0]) {
    //         vscode.window.showInformationMessage(`You selected: ${fileUri[0].fsPath}`);
    //     } else {
    //         vscode.window.showInformationMessage('No file selected.');
    //     }
    // });

    context.subscriptions.push(vscode.commands.registerCommand('retrace.showWebView', async () => {
        const panel = vs
    }));

    context.subscriptions.push(vscode.commands.registerCommand('retrace.pickDirectory', async () => {
        // Open a directory picker dialog
        const folders = await vscode.window.showOpenDialog({
            canSelectFolders: true,
            canSelectFiles: false,
            canSelectMany: false,
            openLabel: 'Select Directory'
        }); 

        if (folders && folders.length > 0) {
            // Get the selected directory path
            const selectedPath = folders[0].fsPath;

            // Set the directory path in the settings
            const config = vscode.workspace.getConfiguration('retrace');
            await config.update('directoryPath', selectedPath, vscode.ConfigurationTarget.Workspace);

            vscode.window.showInformationMessage(`Directory set to: ${selectedPath}`);
        }
    }));

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('retrace_customView', {
            resolveWebviewView(webviewView) {
                webviewView.webview.options = {
                    enableScripts: true // Allow JavaScript execution in the webview
                };

                // Set the HTML content for the webview
                webviewView.webview.html = `
                    <!DOCTYPE html>
                    <html lang="en">
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>Interactive View</title>
                        <style>
                            button {
                                padding: 10px;
                                margin: 5px;
                            }
                        </style>
                    </head>
                    <body>
                        <h1>Interactive View</h1>
                        <button id="myButton">Click Me</button>
                        <script>
                            const vscode = acquireVsCodeApi();
                            document.getElementById('myButton').addEventListener('click', () => {
                                vscode.postMessage({ command: 'buttonClicked' });
                            });
                        </script>
                    </body>
                    </html>
                `;

                // Handle messages from the webview
                webviewView.webview.onDidReceiveMessage(message => {
                    if (message.command === 'buttonClicked') {
                        vscode.window.showInformationMessage('Button was clicked in the view!');
                    }
                });
            }
        })
    );

    context.subscriptions.push(disposable);

    context.subscriptions.push(
        vscode.commands.registerCommand('retrace.addRunConfiguration', async () => {
            const workspaceFolders = vscode.workspace.workspaceFolders;

            if (workspaceFolders) {
                const config = vscode.workspace.getConfiguration('launch', workspaceFolders[0].uri);
                const currentConfigurations = config.get('configurations') || [];
                
                const newConfiguration = {
                    "name": "Retrace - replay1",
                    "type": "debugpy",
                    "request": "launch",
                    "stopOnEntry": true,
                    "justMyCode": false,
                    "cwd": "${command:retrace.replay.cwd}",
                    "env": "${command:retrace.replay.env}",
                    "program": "${command:retrace.replay.program}",
                    "args": "${command:retrace.replay.args}",
                    "python": "${command:retrace.replay.python}",
                };

                // Add the new configuration to the existing ones
                currentConfigurations.push(newConfiguration);

                // Update the launch.json file with the new configuration
                await config.update('configurations', currentConfigurations, vscode.ConfigurationTarget.WorkspaceFolder);

                const currentInputs = config.get('inputs') || [];

                currentInputs.push({
                    "id": "recordingDirectory",
                    "type": "pickFolder",
                    "description": "Enter the path to the recording directory"
                });

                await config.update('inputs', currentInputs, vscode.ConfigurationTarget.WorkspaceFolder);

                vscode.window.showInformationMessage('Retrace Debug replay configuration added to launch.json');
            } else {
                vscode.window.showErrorMessage('No workspace folder found to add configuration.');
            }
        })
    );

    context.subscriptions.push(vscode.commands.registerCommand('retrace.replay.cwd', async () => {
        return null
    }));

    context.subscriptions.push(vscode.commands.registerCommand('retrace.replay.env', async () => {
        return null
    }));

    context.subscriptions.push(vscode.commands.registerCommand('retrace.replay.program', async () => {
        return null
    }));

    context.subscriptions.push(vscode.commands.registerCommand('retrace.replay.args', async () => {
        return null
    }));

    context.subscriptions.push(vscode.commands.registerCommand('retrace.replay.python', async () => {
        return null
    }));

    disposable = vscode.commands.registerCommand('extension.getDynamicEnv', function () {
        // Generate or load your environment JSON dynamically
        const envData = {
            PYTHONPATH: "../retrace-record-replay",
            RETRACE_MODE: "replay",
            RETRACE_EXECUTION_ID: "root"
        };
        return envData;
    });
    context.subscriptions.push(disposable);

    context.subscriptions.push(vscode.commands.registerCommand('retrace.populateLaunchConfig', async () => {
        const recordingDir = await vscode.window.showInputBox({
            prompt: 'Enter the path to the recording directory',
            placeHolder: '/path/to/recordings'
        });
        
        const executionId = await vscode.window.showInputBox({
            prompt: 'Enter the execution ID',
            placeHolder: 'root'
        });

        return {
            recordingDirectory: recordingDir,
            executionId: executionId,
            cwd: null,

        };
    }));

    vscode.commands.executeCommand('retrace.addRunConfiguration');
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};
