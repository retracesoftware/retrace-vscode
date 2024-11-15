import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
//import { TraceSelector } from './TraceSelector';

// Retrace configuration settings.
export interface TraceConfig {
    rootPath: string
    traceName: string
}

interface EnvArgs {
	[key: string]: any;
}

export class TraceExplorerProvider implements vscode.TreeDataProvider<TraceFileItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<TraceFileItem | undefined | void> = new vscode.EventEmitter<TraceFileItem | undefined | void>();
	readonly onDidChangeTreeData: vscode.Event<TraceFileItem | undefined | void> = this._onDidChangeTreeData.event;
    private _traceRoot: string = "";

	constructor(private extensionUri: vscode.Uri) {
        // prompt user for the trace root
        (async () => {
            try {
                this._traceRoot = this.getTraceFolder();
                if (this._traceRoot === '') {
                    this._traceRoot = await this.chooseFolder('Select trace folder name');
                    this.setTraceFolder(this._traceRoot);
                }
        
                console.log(this._traceRoot);
            } catch(e) {
                vscode.window.showInformationMessage(`could not select trace folder: (${e})`);
            }
        })();
	}

    // chooseFolder allows user to select a folder path
    private async chooseFolder(label: string): Promise<string> {
        const folders = await vscode.window.showOpenDialog({
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

    private readDir(parent: TraceFileItem, dir: string, context: string): TraceFileItem[] {
        // read directory and transform into array of TraceFileItems
        try {
            const files = fs.readdirSync(dir, {recursive: false});
            const filtered = files.filter(file => file.at(0) !== '.');            
            return filtered.map((file) => {
                const fpath = path.join(dir, file as string);
                const stat = fs.lstatSync(fpath);
                const collapsible = (stat.isDirectory() || stat.isSymbolicLink()) && context !== "retrace.view";
                return {
                    label: file as string,
                    collapsibleState: collapsible ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
                    parent: parent,
                    contextValue: context
                };
            });
        } catch (ex) {
            return [];
        }
    }

    // refresh the tree
	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

    getTreeItem(element: TraceFileItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }

    getChildren(element?: TraceFileItem | undefined): vscode.ProviderResult<TraceFileItem[]> {
        // get single node for retrace configuration
        if (!element) {
            return [
                new TraceFileItem(this._traceRoot, vscode.TreeItemCollapsibleState.None, undefined),
                new TraceFileItem("Root", vscode.TreeItemCollapsibleState.Collapsed, undefined, "root")
             ];
        } else {
            // get children for the specified element, should be a directory
            let ctx = 'retrace.view';
            switch(element.contextValue) {
                case 'root':
                    ctx = "app";
                    break;
                case 'app':
                    ctx = "retrace.view";
                    break;
            }

            // build directory
            const dir = this.getPath(element, "");
            return this.readDir(element, dir, ctx);
        }
    }

    getParent?(element: TraceFileItem): vscode.ProviderResult<TraceFileItem> {
        return element.parent;
    }

    resolveTreeItem?(item: vscode.TreeItem, element: TraceFileItem, token: vscode.CancellationToken): vscode.ProviderResult<vscode.TreeItem> {
        throw new Error('Method not implemented.');
    }

    async editConfig(node: TraceFileItem) {
        // Edit the run configuration for the selected process.

        // get path for the node
        const dir = this.getPath(node, "");
        if (!isValidPath(dir)) {
            vscode.window.showInformationMessage(`invalid trace process folder : ${dir}`);
            return;
        }

        // read all files in the process node to build run debug configuration
        try {
            const cwd = await this.readFile(dir, 'cwd');

            // read 'env'
            const env = await this.readFile(dir, 'env');

            // read 'exe' (python)
            const programArgs = await this.readProgramAndArgs(dir);

            const exe = await this.readFile(dir, 'exe');

            // update or create the run debug configuration
            this.upsertConfig(node, cwd, env, programArgs, exe);

        } catch (err) {
            vscode.window.showInformationMessage(`failed to update run configuration : ${node}`);
        }        
    }

    // create or update the debug configuration.
    private async upsertConfig(node: TraceFileItem, cwd: string, env: string, programArgs: string[], exe: string) {
        // get the workspace folders for access to launch configs
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage('No workspace folder found to add configuration.');
            return;
        }

        const config = vscode.workspace.getConfiguration('launch', workspaceFolders[0].uri);
        const currentConfigurations = config.get<vscode.DebugConfiguration[]>('configurations') || [];
        const configName = `Retrace - ${node.label}`;
        let retraceConfig = currentConfigurations.find(config => config.name === configName);
        if (!retraceConfig) {
            console.log('configuration not found, creating...');
            retraceConfig = {
                "name": configName,
                "type": "debugpy",
                "request": "launch",
                "stopOnEntry": true,
                "justMyCode": false,
                } as vscode.DebugConfiguration;
        }

        // update the configuration
        retraceConfig["cwd"] = cwd;
        retraceConfig["env"] = this.buildEnv(env);
        retraceConfig["program"] = programArgs[1];
        retraceConfig["args"] = [];
        retraceConfig["python"] = exe;

        // const newConfiguration = {
        //     "name": "Retrace - replay1",
        //     "type": "debugpy",
        //     "request": "launch",
        //     "stopOnEntry": true,
        //     "justMyCode": false,
        //     "cwd": cwd,
        //     "env": env,
        //     "program": programArgs[1],
        //     "args": "",
        //     "python": exe,
        // };

        // launch the debug session
        const reason = await vscode.debug.startDebugging(workspaceFolders[0], retraceConfig);
        if (reason) {
            console.log('Debug session started');
        } else {
            vscode.window.showErrorMessage('Failed to start debug session:');
        }
    }

    // buildEnv parses the supplied environment string consisting of lines with format 'field=value' into
    // an object
    private buildEnv(env: string): EnvArgs {
        let envArgs = {} as EnvArgs;
        const lines = env.split('\n');

        // now split each line field value pairs
        lines.forEach((line) => {
            const fv = line.split('=');
            envArgs[fv[0]] = fv[1];
        });

        return envArgs;
    }

    private async readProgramAndArgs(dir: string): Promise<string[]> {
        const text = await this.readFile(dir, 'cmd');
        const json: string[] = JSON.parse(text);

        console.log(json);

        return json;
    }

    private async readFile(dir: string, name: string): Promise<string> {
        try {
            const file = path.join(dir, name);
            if (!isValidPath(file)) {
                throw new Error(`process ${name} file is missing: ${file}`);
            }
    
            const data = await fs.promises.readFile(file, {encoding: 'utf8'});
            console.log(data);
            return data;
        } catch (err) {
            console.error('Error reading file:', err);
        }

        return "";
    }        
    
    // getPath for the element
    private getPath(el: TraceFileItem, dir: string): string {
        if (el.parent !== undefined) {
            dir = this.getPath(el.parent, dir);
        } else {
            return this._traceRoot;
        }

        return path.join(dir, el.label);
    }

    // getTraceFolder checks if there is an existing trace folder defined in configuration
    private getTraceFolder(): string {
        // get previous folder from config if available
        const config = vscode.workspace.getConfiguration('retrace');
        let rootPath = config.get<string>('rootPath');

        rootPath = rootPath ?? '';

        // check if directory path is valid
        if (rootPath !== '' && !isValidPath(rootPath)) {
            vscode.window.showInformationMessage(`invalid root trace folder : ${rootPath}`);
        }

        return rootPath;
    }

    private async setTraceFolder(rootPath: string) {
        // set new trace config values
        const config = vscode.workspace.getConfiguration('retrace');
        if (config !== null) {
            // Set the trace root and trace folder
            await config.update('rootPath', rootPath, vscode.ConfigurationTarget.Workspace);
            vscode.window.showInformationMessage(`retrace configuration updated: ${rootPath}`);
        }
    }

    generateDebugConfig(config: TraceConfig) {
        vscode.window.showInformationMessage(`generating debug configuration... ${config}`);
    }
}

function isValidPath(path: string): boolean {
    try {
        fs.accessSync(path, fs.constants.F_OK);
        return true;
    } catch (err) {
        return false;
    }
}
  
export class TraceFileItem extends vscode.TreeItem {
	constructor(
		public readonly label: string,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly parent?: TraceFileItem,
        public readonly contextValue?: string,
		public readonly command?: vscode.Command) {

		super(label, collapsibleState);

		this.tooltip = `${this.label}`; //-${this.version}`;
		this.description = this.label; //this.version;
	}

    //contextValue = "retrace.view";
}
