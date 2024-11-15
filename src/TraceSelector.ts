import * as vscode from 'vscode';
import * as path from 'path';

import { TraceExplorerProvider, TraceConfig } from './TraceTree';

const window = vscode.window;
const commands = vscode.commands;
const workspace = vscode.workspace;
//const WebviewPanel = vscode.WebviewPanel
const ConfigurationTarget = vscode.ConfigurationTarget;


// RetraceVeiwProvider provides the WebviewView for the extension
export class TraceSelector {
	public static readonly viewType = 'retrace.configurationView';
	public static instance: TraceSelector | undefined;
	private _view?: vscode.Webview;

    // createOrShow creates or shows the trace configuration form
	public static createOrShow(p: TraceExplorerProvider, extensionUri: vscode.Uri, config: TraceConfig) {
		const column = vscode.window.activeTextEditor
			? vscode.window.activeTextEditor.viewColumn
			: undefined;

		// If we already have a panel, show it.
		if (TraceSelector.instance && TraceSelector.instance._panel) {
			TraceSelector.instance._panel.reveal(column);
			return;
		}

		// Otherwise, create a new panel.
		const panel = vscode.window.createWebviewPanel(
			TraceSelector.viewType,
            'Retrace Settings',
            //vscode.ViewColumn.Beside,
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [
                    extensionUri
                ]
            }
        );

        TraceSelector.instance = new TraceSelector(p, panel, extensionUri);
        TraceSelector.instance.updateTraceView(config);
	}

    // constructor
	private constructor(private provider: TraceExplorerProvider, private _panel: vscode.WebviewPanel | null, private readonly _extensionUri: vscode.Uri) {
        const webview = this._panel?.webview ?? null;
        if (webview !== null) {
            webview.html = this._getWebviewContent(webview);

            this._panel?.onDidDispose(() => {
                console.log('Webview panel closed or destroyed');
                // Perform cleanup tasks here, such as removing listeners, disposing resources, etc.
                this._panel = null;
            });
        
            // processes messages
            webview.onDidReceiveMessage(data => {
                switch (data.command) {
                    case 'retrace.rootFolder': {                        
                        this.chooseRootFolder();
                        break;
                    }
                    case 'retrace.traceName': {
                        this.chooseTraceName();
                        break;
                    }
                    case 'retrace.generateConfig': {
                        window.showInformationMessage(`Generate debug configuration... ${data.value}`);
                        this.generateConfig(data.value);
                    }
                }
            });        

            this._view = webview;
        }
    }

    // update the trace root path and trace name in the view.
    private updateTraceView(config: TraceConfig) {
        if (this._view) {
            this._view.postMessage({
                type: 'updateTraceView',
                value: config
            });
        }
    }

    public async chooseRootFolder() {
        // Open a directory picker dialog
        window.showInformationMessage(`Root folder request...`);

        const folder = await this.chooseFolder('Select trace folder name');
        if (folder !== '') {
            if (this._view) {
                this._view.postMessage({
                    type: 'setRootFolder',
                    path: folder
                });
            }
        }
    }

    public async chooseTraceName() {
        // Open a directory picker dialog
        window.showInformationMessage(`Trace name requested...`);

        const folder = await this.chooseFolder('Select trace folder name');
        if (folder !== '') {
            // use basename of trace folder for name
            const name = path.basename(folder);
            if (this._view) {
                this._view.postMessage({
                    type: 'setTraceName',
                    path: name
                });
            }
        }
    }

    // chooseFolder allows user to select a folder path
    private async chooseFolder(label: string): Promise<string> {
        const folders = await window.showOpenDialog({
            canSelectFolders: true,
            canSelectFiles: false,
            canSelectMany: false,
            openLabel: label
        }); 

        if (folders && folders.length > 0) {
            // Get the selected directory path
            return folders[0].fsPath;
        }

        return "";
    }

    // TODO fix this for generateConfig
    public async generateConfig(traceConfig: TraceConfig) {
        // set new trace config values
        const config = workspace.getConfiguration('retrace');
        if (config !== null) {
            // Set the trace root and trace folder
            await config.update('rootPath', traceConfig.rootPath, ConfigurationTarget.Workspace);
            await config.update('traceName', traceConfig.traceName, ConfigurationTarget.Workspace);
            window.showInformationMessage(`retrace configuration updated: ${traceConfig}`);
        }

        // generate the new retrace run configuration
        window.showInformationMessage(`about to create debug configuration for: ${traceConfig}`);
        //addRunConfiguration();
    }

	private _getWebviewContent(webview: vscode.Webview) {
		// Get the local path to main script run in the webview, then convert it to a uri we can use in the webview.
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'resources', 'retrace.js'));

		// Do the same for the stylesheet.
		const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'resources', 'retrace.css'));
		const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'resources', 'vscode.css'));
		const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'resources', 'main.css'));

		// Use a nonce to only allow a specific script to be run.
		const nonce = getNonce();

		return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">

            <!--
                Use a content security policy to only allow loading styles from our extension directory,
                and only allow scripts that have a specific nonce.
                (See the 'webview-sample' extension sample for img-src content security policy examples)
            -->
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">

            <meta name="viewport" content="width=device-width, initial-scale=1.0">

            <link href="${styleResetUri}" rel="stylesheet">
            <link href="${styleVSCodeUri}" rel="stylesheet">
            <link href="${styleMainUri}" rel="stylesheet">

            <title>Retrace Debug Configuration</title>
        </head>
        <body>
            <h2>Retrace debug configuration</h2>
            <p>Select the root folder of your trace files.</p>
                <input type="text" id="root-folder" name="root-folder" placeholder="root folder...">
                <button class="root-folder-button"">Select retrace root folder</button>

                <p>Select the name of the trace folder you want to debug</p>
                <input type="text" id="trace-folder" name="trace-folder" placeholder="trace name...">
                <button class="trace-folder-button">Select trace folder</button>

                <p>Generate the retrace debug configuration for the selected trace files</p>
                <button class="gen-config-button">Generate debug configuration</button>
			<script nonce="${nonce}" src="${scriptUri}"></script>
            </script>
        </body>
        </html>`;
	}

} 

function getNonce() {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}
