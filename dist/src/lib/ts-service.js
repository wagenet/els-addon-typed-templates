"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ts = require("typescript");
const path = require("path");
const fs = require("fs");
const utils_1 = require("./utils");
const services = {};
const components = new WeakMap();
function componentsForService(service, clean = false) {
    if (clean) {
        components.set(service, {});
    }
    return components.get(service);
}
exports.componentsForService = componentsForService;
const STABLE_FILES = new Map();
const PROJECTS_MAP = new Map();
function registerProject(item) {
    PROJECTS_MAP.set(item.root.split(":").pop(), {
        project: item,
        files: new WeakMap()
    });
}
exports.registerProject = registerProject;
function serviceForRoot(uri) {
    if (!services[uri]) {
        const registry = ts.createDocumentRegistry(false, uri);
        const project = PROJECTS_MAP.get(uri);
        let tsConfig = {};
        if (fs.existsSync(path.join(uri, "tsconfig.json"))) {
            try {
                tsConfig = JSON.parse(fs.readFileSync(path.join(uri, "tsconfig.json"), "utf8"));
                if (tsConfig && tsConfig.compilerOptions) {
                    tsConfig = tsConfig.compilerOptions;
                }
            }
            catch (e) {
                //
            }
        }
        function initialProjectFileStructure() {
            let walkParams = {
                directories: true,
                globs: ["**/*.{js,ts,d.ts}"]
            };
            let appEntry = path.join(uri, "app");
            let addonEntry = path.join(uri, "addon");
            let typesEntry = path.join(uri, "types");
            let commonTypes = path.join(__dirname, "./../../../src/lib/common-types.d.ts");
            let projectTypes = utils_1.safeWalkSync(path.join(uri, "types"), walkParams).map(el => path.resolve(path.join(typesEntry, el)));
            let projectAppFiles = utils_1.safeWalkSync(path.join(uri, "app"), walkParams).map(el => path.resolve(path.join(appEntry, el)));
            let projectAddonFiles = utils_1.safeWalkSync(path.join(uri, "addon"), walkParams).map(el => path.resolve(path.join(addonEntry, el)));
            return Array.from(new Set([
                commonTypes,
                ...projectTypes,
                ...projectAppFiles,
                ...projectAddonFiles
            ]));
        }
        const initialFiles = initialProjectFileStructure();
        // console.log('tsConfig', tsConfig);
        const host = {
            getCompilationSettings() {
                return Object.assign({}, tsConfig, {
                    baseUrl: ".",
                    allowJs: true,
                    allowSyntheticDefaultImports: true,
                    skipLibCheck: true,
                    experimentalDecorators: true,
                    noImplicitAny: false,
                    moduleResolution: ts.ModuleResolutionKind.NodeJs,
                    strictPropertyInitialization: false,
                    module: ts.ModuleKind.ES2015
                });
            },
            getScriptFileNames() {
                let els = [...Object.keys(componentsForService(services[uri]))];
                return Array.from(new Set([...initialFiles, ...els, ...project.project.files.keys()]));
            },
            getScriptVersion(fileName) {
                const _fileName = path.resolve(fileName);
                if (project.project.files.has(_fileName)) {
                    return project.project.files.get(_fileName).version.toString();
                }
                if (STABLE_FILES.has(_fileName)) {
                    return STABLE_FILES.get(_fileName).version.toString();
                }
                if (fs.existsSync(_fileName)) {
                    let stats = fs.statSync(_fileName);
                    return stats.mtime.getTime().toString();
                }
                return Date.now().toString();
            },
            getScriptSnapshot(rawFileName) {
                const maybeVirtualFile = componentsForService(services[uri])[path.resolve(rawFileName)];
                if (maybeVirtualFile) {
                    // if file is virtual (constructed template) -> return fresh snapshot
                    return ts.ScriptSnapshot.fromString(maybeVirtualFile);
                }
                else {
                    let fileName = path.resolve(path.normalize(rawFileName));
                    // if project has changed files
                    if (project.project.files.has(fileName)) {
                        // project changed file
                        let mirror = project.project.files.get(fileName);
                        // ts mirrors
                        if (project.files.has(mirror)) {
                            let tsMeta = project.files.get(mirror);
                            // if no ts-mirror - we must create it;
                            if (!tsMeta) {
                                tsMeta = {
                                    version: -1,
                                    snapshot: ts.ScriptSnapshot.fromString("")
                                };
                                project.files.set(mirror, tsMeta);
                            }
                            if (tsMeta.version !== mirror.version) {
                                // if versions different - we need to update file
                                tsMeta.snapshot = ts.ScriptSnapshot.fromString(fs.readFileSync(fileName).toString());
                                if (STABLE_FILES.has(fileName)) {
                                    const stableItem = STABLE_FILES.get(fileName);
                                    stableItem.snapshot = tsMeta.snapshot;
                                    stableItem.version = tsMeta.version;
                                }
                            }
                            return tsMeta.snapshot;
                        }
                    }
                    else {
                        // if file is not marked as changed, we count it as stable
                        if (!STABLE_FILES.has(fileName) && fs.existsSync(fileName)) {
                            // if no stable record, but file exists - we must create it.
                            STABLE_FILES.set(fileName, {
                                version: 0,
                                snapshot: ts.ScriptSnapshot.fromString(fs.readFileSync(fileName).toString())
                            });
                        }
                        if (STABLE_FILES.has(fileName)) {
                            return STABLE_FILES.get(fileName).snapshot;
                        }
                        // file not exists
                        let name = path.basename(fileName, path.extname(fileName));
                        let libName = "lib." + name.toLowerCase() + ".d.ts";
                        let libFileNmae = path.join(path.dirname(fileName), libName);
                        if (fs.existsSync(libFileNmae)) {
                            return ts.ScriptSnapshot.fromString(fs.readFileSync(libFileNmae).toString());
                        }
                        return ts.ScriptSnapshot.fromString("");
                    }
                }
            },
            getCurrentDirectory: () => {
                return path.resolve(uri);
            },
            getDefaultLibFileName(opts) {
                return path.resolve(ts.getDefaultLibFilePath(opts));
            }
        };
        services[uri] = ts.createLanguageService(host, registry);
        components.set(services[uri], {});
    }
    return services[uri];
}
exports.serviceForRoot = serviceForRoot;
//# sourceMappingURL=ts-service.js.map