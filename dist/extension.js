"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var vscode2 = __toESM(require("vscode"));

// src/TraceTree.ts
var vscode = __toESM(require("vscode"));
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
var TraceExplorerProvider = class {
  constructor(extensionUri) {
    this.extensionUri = extensionUri;
    (async () => {
      try {
        this._traceRoot = this.getTraceFolder();
        if (this._traceRoot === "") {
          this._traceRoot = await this.chooseFolder("Select trace folder name");
          this.setTraceFolder(this._traceRoot);
        }
        console.log(this._traceRoot);
      } catch (e) {
        vscode.window.showInformationMessage(`could not select trace folder: (${e})`);
      }
    })();
  }
  _onDidChangeTreeData = new vscode.EventEmitter();
  onDidChangeTreeData = this._onDidChangeTreeData.event;
  _traceRoot = "";
  // chooseFolder allows user to select a folder path
  async chooseFolder(label) {
    const folders = await vscode.window.showOpenDialog({
      canSelectFolders: true,
      canSelectFiles: false,
      canSelectMany: false,
      openLabel: label
    });
    if (folders && folders.length > 0) {
      return folders[0].fsPath;
    }
    return "";
  }
  readDir(parent, dir, context) {
    try {
      const files = fs.readdirSync(dir, { recursive: false });
      const filtered = files.filter((file) => file.at(0) !== ".");
      return filtered.map((file) => {
        const fpath = path.join(dir, file);
        const stat = fs.lstatSync(fpath);
        const collapsible = (stat.isDirectory() || stat.isSymbolicLink()) && context !== "retrace.view";
        return {
          label: file,
          collapsibleState: collapsible ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
          parent,
          contextValue: context
        };
      });
    } catch (ex) {
      return [];
    }
  }
  // refresh the tree
  refresh() {
    this._onDidChangeTreeData.fire();
  }
  getTreeItem(element) {
    return element;
  }
  getChildren(element) {
    if (!element) {
      return [
        new TraceFileItem(this._traceRoot, vscode.TreeItemCollapsibleState.None, void 0),
        new TraceFileItem("Root", vscode.TreeItemCollapsibleState.Collapsed, void 0, "root")
      ];
    } else {
      let ctx = "retrace.view";
      switch (element.contextValue) {
        case "root":
          ctx = "app";
          break;
        case "app":
          ctx = "retrace.view";
          break;
      }
      const dir = this.getPath(element, "");
      return this.readDir(element, dir, ctx);
    }
  }
  getParent(element) {
    return element.parent;
  }
  resolveTreeItem(item, element, token) {
    throw new Error("Method not implemented.");
  }
  async editConfig(node) {
    const dir = this.getPath(node, "");
    if (!isValidPath(dir)) {
      vscode.window.showInformationMessage(`invalid trace process folder : ${dir}`);
      return;
    }
    try {
      const cwd = await this.readFile(dir, "cwd");
      const env = await this.readFile(dir, "env");
      const programArgs = await this.readProgramAndArgs(dir);
      const exe = await this.readFile(dir, "exe");
      this.upsertConfig(node, cwd, env, programArgs, exe);
    } catch (err) {
      vscode.window.showInformationMessage(`failed to update run configuration : ${node}`);
    }
  }
  // create or update the debug configuration.
  async upsertConfig(node, cwd, env, programArgs, exe) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      vscode.window.showErrorMessage("No workspace folder found to add configuration.");
      return;
    }
    const config = vscode.workspace.getConfiguration("launch", workspaceFolders[0].uri);
    const currentConfigurations = config.get("configurations") || [];
    const configName = `Retrace - ${node.label}`;
    let retraceConfig = currentConfigurations.find((config2) => config2.name === configName);
    if (!retraceConfig) {
      console.log("configuration not found, creating...");
      retraceConfig = {
        "name": configName,
        "type": "debugpy",
        "request": "launch",
        "stopOnEntry": true,
        "justMyCode": false
      };
    }
    retraceConfig["cwd"] = cwd;
    retraceConfig["env"] = this.buildEnv(env);
    retraceConfig["program"] = programArgs[1];
    retraceConfig["args"] = [];
    retraceConfig["python"] = exe;
    const reason = await vscode.debug.startDebugging(workspaceFolders[0], retraceConfig);
    if (reason) {
      console.log("Debug session started");
    } else {
      vscode.window.showErrorMessage("Failed to start debug session:");
    }
  }
  // buildEnv parses the supplied environment string consisting of lines with format 'field=value' into
  // an object
  buildEnv(env) {
    let envArgs = {};
    const lines = env.split("\n");
    lines.forEach((line) => {
      const fv = line.split("=");
      envArgs[fv[0]] = fv[1];
    });
    return envArgs;
  }
  async readProgramAndArgs(dir) {
    const text = await this.readFile(dir, "cmd");
    const json = JSON.parse(text);
    console.log(json);
    return json;
  }
  async readFile(dir, name) {
    try {
      const file = path.join(dir, name);
      if (!isValidPath(file)) {
        throw new Error(`process ${name} file is missing: ${file}`);
      }
      const data = await fs.promises.readFile(file, { encoding: "utf8" });
      console.log(data);
      return data;
    } catch (err) {
      console.error("Error reading file:", err);
    }
    return "";
  }
  // getPath for the element
  getPath(el, dir) {
    if (el.parent !== void 0) {
      dir = this.getPath(el.parent, dir);
    } else {
      return this._traceRoot;
    }
    return path.join(dir, el.label);
  }
  // getTraceFolder checks if there is an existing trace folder defined in configuration
  getTraceFolder() {
    const config = vscode.workspace.getConfiguration("retrace");
    let rootPath = config.get("rootPath");
    rootPath = rootPath ?? "";
    if (rootPath !== "" && !isValidPath(rootPath)) {
      vscode.window.showInformationMessage(`invalid root trace folder : ${rootPath}`);
    }
    return rootPath;
  }
  async setTraceFolder(rootPath) {
    const config = vscode.workspace.getConfiguration("retrace");
    if (config !== null) {
      await config.update("rootPath", rootPath, vscode.ConfigurationTarget.Workspace);
      vscode.window.showInformationMessage(`retrace configuration updated: ${rootPath}`);
    }
  }
  generateDebugConfig(config) {
    vscode.window.showInformationMessage(`generating debug configuration... ${config}`);
  }
};
function isValidPath(path2) {
  try {
    fs.accessSync(path2, fs.constants.F_OK);
    return true;
  } catch (err) {
    return false;
  }
}
var TraceFileItem = class extends vscode.TreeItem {
  constructor(label, collapsibleState, parent, contextValue, command) {
    super(label, collapsibleState);
    this.label = label;
    this.collapsibleState = collapsibleState;
    this.parent = parent;
    this.contextValue = contextValue;
    this.command = command;
    this.tooltip = `${this.label}`;
    this.description = this.label;
  }
  //contextValue = "retrace.view";
};

// src/extension.ts
var window3 = vscode2.window;
function activate(context) {
  console.log("Activating retrace debug launcher!!!!!");
  window3.showInformationMessage("Activating retrace debug launcher!!!!!");
  const provider = new TraceExplorerProvider(context.extensionUri);
  context.subscriptions.push(vscode2.window.registerTreeDataProvider("retrace.configurationView", provider));
  context.subscriptions.push(vscode2.commands.registerCommand("retrace.configurationView.editEntry", (node) => {
    vscode2.window.showInformationMessage(`Successfully called edit entry on ${node.label}.`);
    provider.editConfig(node);
  }));
}
function deactivate() {
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
//# sourceMappingURL=extension.js.map
