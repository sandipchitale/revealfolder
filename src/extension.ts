'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

import * as path from 'path';
import * as fs from 'fs';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    let disposable = vscode.commands.registerCommand('extension.revealfolder', revealFolder);

    context.subscriptions.push(disposable);

}

// this method is called when your extension is deactivated
export function deactivate() {
}

const processedPaths = {};
const folderNameToPaths = {};

function revealFolder(uri) {
    if (!uri) {
        vscode.window.showInformationMessage('Select folder to search under.');
        return;
    }
    let contextFolder = vscode.workspace.rootPath;
    let displayContextFolder = contextFolder;
    if (uri) {
        if (isDirectory(uri.fsPath)) {
            contextFolder = uri.fsPath;
            displayContextFolder = contextFolder.substring(vscode.workspace.rootPath.length + 1);
        }
    }
    vscode.window.showInputBox({
        placeHolder: 'Enter match pattern',
        prompt: 'Context folder is ' + displayContextFolder
    }).then(async (match) => {
        if (!match) {
            return;
        }
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Finding folders matching \'' + match + '\' ' + ' in \'' +  contextFolder.substring(vscode.workspace.rootPath.length + 1) + '\' '
        }, (progress, token) => {
            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    const flags = (process.platform === 'win32' ? 'i' : '');
                    const matchLikeQuickOpenStrategy = vscode.workspace.getConfiguration('revealfolder').matchLikeQuickOpenStrategy;
                    const matched = [];
                    const matchRegExp = (matchLikeQuickOpenStrategy ?
                        new RegExp('^.*' + match.split('').join('.*') + '.*$', flags)
                        :
                        new RegExp('^.*' + match + '.*$', flags));
                    find(match, contextFolder);
                    for (let folderName in folderNameToPaths) {
                        if (folderName.match(matchRegExp)) {
                            matched.push(...folderNameToPaths[folderName]);
                        }
                    }
                    matched.sort();
                    resolve(matched);
                }, 10);
            });
        }).then((matched: string[]) => {
            if (matched.length === 0) {
                vscode.window.showErrorMessage('None matched');
            } else {
                setTimeout(() => {
                    const abbreviatedMatched = matched.map((m) => m.substring(contextFolder.length + 1));
                    vscode.window.showQuickPick(abbreviatedMatched,
                    {
                        placeHolder: 'Select subfolder of ' + contextFolder.substring(vscode.workspace.rootPath.length + 1)
                    })
                    .then((selectedFolder) => {
                        const absoluteSelectedFolder = path.join(contextFolder, selectedFolder);
                        const files = fs.readdirSync(absoluteSelectedFolder);
                        for(let i = 0; i < files.length; i++) {
                            const absoluteFile = path.join(absoluteSelectedFolder, files[i]);
                            if (isFile(absoluteFile)) {
                                vscode.workspace
                                .openTextDocument(absoluteFile)
                                .then(doc => {
                                    const visibleTextEditors = [...vscode.window.visibleTextEditors];
                                    vscode.window.showTextDocument(doc, {preview: false}).then((textEditor) => {
                                        vscode.commands.executeCommand('workbench.files.action.showActiveFileInExplorer').then(() => {
                                            // if (visibleTextEditors.indexOf(textEditor) === -1) {0
                                            //     vscode.commands.executeCommand('workbench.action.closeActiveEditor');
                                            // }
                                        });
                                    });
                                });
                                break;
                            }
                        }
                    },
                    (reason) => {
                        console.log(reason);
                    });
                }, 10);
            }
        },
        (reason) => {
            console.log(reason);
        });
    });
}

function find(match, parent) {
    if  (!processedPaths[parent]) {
        processedPaths[parent] = true;
        const files = fs.readdirSync(parent);

        files.forEach((file) => {
            const absoluteFile = path.join(parent, file);
            if (isDirectory(absoluteFile)) {
                const pathsForFolderName = folderNameToPaths[file];
                if (pathsForFolderName) {
                    pathsForFolderName.push(absoluteFile);
                } else {
                    folderNameToPaths[file] = [absoluteFile];
                }
                find(match, absoluteFile);
            }
        });
    }
}

function isFile(path) {
    try {
        return fs.statSync(path) && fs.statSync(path).isFile()
    } catch (e) {
        return false;
    }
}

function isDirectory(path) {
    try {
        return fs.statSync(path) && fs.statSync(path).isDirectory()
    } catch (e) {
        return false;
    }
}