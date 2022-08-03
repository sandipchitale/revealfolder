'use strict';
import * as vscode from 'vscode';

import * as path from 'path';
import * as fs from 'fs';

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(vscode.commands.registerCommand('extension.revealfolder', revealFolder));
    context.subscriptions.push(vscode.commands.registerCommand('extension.clearrevealfoldercache', clearrevealfoldercache));
}

export function deactivate() {
}let processedPaths = {};
const folderNameToPaths = {};

function revealFolder(uri: vscode.Uri) {
    if (!uri) {
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            uri = vscode.workspace.workspaceFolders[0].uri;
        } else {
            vscode.window.showInformationMessage('Select folder to search under.');
            return;
        }
    }
    let contextFolder = vscode.workspace.rootPath;
    let displayContextFolder = contextFolder;
    if (uri) {
        if (isDirectory(uri.fsPath)) {
            contextFolder = uri.fsPath;
            displayContextFolder = contextFolder.substring(vscode.workspace.workspaceFolders[0].uri.fsPath.length + 1);
            if (displayContextFolder === '') {
                displayContextFolder = vscode.workspace.name;
            }
        }
    }
    vscode.window.showInputBox({
        placeHolder: 'Search folders by name',
        prompt: `Context folder is \'${displayContextFolder}\'`
    }).then(async (match) => {
        if (!match) {
            return;
        }
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Finding folders matching \'${match}\'  in \'${contextFolder.substring(vscode.workspace.rootPath.length + 1)}\' `
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
                    let subfolderOf = contextFolder.substring(vscode.workspace.rootPath.length + 1);
                    if (subfolderOf.trim().length === 0) {
                        subfolderOf = vscode.workspace.rootPath;
                    }
                    vscode.window.showQuickPick(abbreviatedMatched,
                    {
                        placeHolder: `Select subfolder of ${subfolderOf}`
                    })
                    .then((selectedFolder) => {
                        vscode.commands.executeCommand('revealInExplorer', vscode.Uri.file(path.join(contextFolder, selectedFolder)));
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

function find(match: string, parent: string) {
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

function clearrevealfoldercache() {
    processedPaths = {};
}

function isFile(path: fs.PathLike) {
    try {
        return fs.statSync(path) && fs.statSync(path).isFile()
    } catch (e) {
        return false;
    }
}

function isDirectory(path: fs.PathLike) {
    try {
        return fs.statSync(path) && fs.statSync(path).isDirectory()
    } catch (e) {
        return false;
    }
}