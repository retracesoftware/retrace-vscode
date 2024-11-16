//import { window, commands, workspace, ConfigurationTarget, ViewColumn, WebviewPanel } from 'vscode';
import * as vscode from "vscode";

import { TraceExplorerProvider, TraceFileItem } from './TraceTree';

const window = vscode.window;

// activate activates the vscode extension
export function activate(context: vscode.ExtensionContext) {
    console.log('Activating retrace debug launcher!!!!!');
    window.showInformationMessage('Activating retrace debug launcher!!!!!');

	const provider = new TraceExplorerProvider(context.extensionUri);
	context.subscriptions.push(vscode.window.registerTreeDataProvider('retrace.configurationView', provider));

	vscode.commands.registerCommand('retrace.configurationView.refreshEntry', () => provider.refresh());
	vscode.commands.registerCommand('retrace.configurationView.newTrace', () => provider.setNewTraceFolder());
	context.subscriptions.push(vscode.commands.registerCommand('retrace.configurationView.editEntry', (node: TraceFileItem) => {
        vscode.window.showInformationMessage(`Successfully called edit entry on ${node.label}.`);
        provider.editConfig(node);
    }));
}

export function deactivate() {}
