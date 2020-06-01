
import {
    isParamPath,
    isArgumentName,
    realPathName,
    canHandle,
    normalizeArgumentName
} from "./../lib/ast-helpers";

import { createVirtualTemplate } from "./../lib/virtual-documents";

import {
    normalizeDefinitions
} from "./../lib/ls-utils";

import { virtualTemplateFileName } from "./../lib/resolvers";

import { serviceForRoot, componentsForService } from './../lib/ts-service';
import { Project, DefinitionFunctionParams } from '../interfaces';
import { toFilePath } from '../lib/utils';

export default class DefinitionProvider {
    constructor(private project: Project) { }
    async onDefinition(
        { results, focusPath, type, textDocument }: DefinitionFunctionParams
    ) {
        if (!canHandle(type, focusPath)) {
            return results;
        }
        try {
            const isParam = isParamPath(focusPath);
            const projectRoot = this.project.root;
            const service = serviceForRoot(projectRoot);
            const componentsMap = componentsForService(service);
            const templatePath = toFilePath(textDocument.uri);
            let isArg = false;
            let realPath = realPathName(focusPath);
            if (isArgumentName(realPath)) {
                isArg = true;
                realPath = normalizeArgumentName(realPath);
            }

            const fileName = virtualTemplateFileName(templatePath);
            const { pos } = createVirtualTemplate(
                projectRoot,
                componentsMap,
                fileName,
                {
                    templatePath,
                    realPath,
                    isArg,
                    isParam
                }
            );
            let definitionResults = service.getDefinitionAtPosition(fileName, pos);
            if (!definitionResults) {
                return [];
            }
            const data = normalizeDefinitions(definitionResults);
            return data;
        } catch (e) {
            console.error(e, e.ProgramFiles);
        }
        return results;
    }
}