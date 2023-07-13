"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const axios_1 = require("axios");
const Markup = require("markup-js");
const svgo_1 = require("svgo");
const helpers_1 = require("./helpers");
const templates_1 = require("./templates");
const defaultTokens = ["colors", "space", "fontSizes", "fonts", "fontWeights", "lineHeights", "letterSpacings", "textTransforms"];
const tokenSingulars = {
    colors: "color",
    space: "space",
    fontSizes: "size",
    fonts: "family",
    fontWeights: "weight",
    lineHeights: "line",
    letterSpacings: "spacing",
    textTransforms: "textTransform",
    icons: "icon",
    illustrations: "illustration",
};
class FigmaParser {
    constructor(settings) {
        /**
         * Trigger parse and apply template
         */
        this.parse = (fileId, nodeId, tokens) => __awaiter(this, void 0, void 0, function* () {
            this.fileId = fileId;
            this.nodeId = nodeId;
            this.tokens = tokens || defaultTokens;
            if (!this.output) {
                this.output = {
                    content: {},
                    colors: {},
                    space: {},
                    icons: {},
                    fonts: {},
                    fontWeights: {},
                    fontSizes: {},
                    lineHeights: {},
                    letterSpacings: {},
                    textTransforms: {},
                    illustrations: {},
                };
            }
            const document = yield this.request();
            if (!document) {
                throw new Error("Error loading file");
            }
            const pageList = document.children;
            yield this.parseTree(pageList, "");
            return this.output;
        });
        /**
         * Format token output to a markup template
         */
        this.markup = (template, input) => {
            if (!input) {
                input = this.output;
            }
            for (let token in input) {
                if (Object.keys(input[token]).length === 0) {
                    delete input[token];
                }
            }
            const arrayInput = Object.keys(input)
                .map((token) => ({ token, singular: tokenSingulars[token], attributes: Object.keys(input[token]).map((attr) => ({ name: attr, value: input[token][attr] })) }))
                .filter((item) => item.attributes.length > 0);
            if (template === "json") {
                return JSON.stringify(input, null, 2);
            }
            let result = Markup.up(template ? templates_1.default[template] || template : templates_1.default.ts, { tokens: arrayInput });
            return result;
        };
        /**
         * Make an API request call
         */
        this.request = () => __awaiter(this, void 0, void 0, function* () {
            return this.client
                .get(`files/${this.fileId}?nodes=${this.nodeId}`)
                .then((data) => {
                return data.data.document;
            })
                .catch((error) => {
                return error.data.status;
            });
        });
        /**
         * Make an API request call
         */
        this.getImage = (imageId) => __awaiter(this, void 0, void 0, function* () {
            const response = yield this.client.get(`images/${this.fileId}?ids=${imageId}&format=svg`);
            if (response.data.images[imageId]) {
                const { data } = yield axios_1.default.get(response.data.images[imageId], { responseType: "text" });
                return data;
            }
        });
        /**
         * Parse provided Page following parse rules
         */
        let contentCount = 0;
        this.parseTree = (pages, parentName) => __awaiter(this, void 0, void 0, function* () {
            // console.log("page number ", count++);

            for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
                // console.log("pageIndex is!", pageIndex);
                // console.log("page is!", pages[pageIndex])
                const page = pages[pageIndex];
                const nameParts = page.name.split("-");
                if (page["children"]) {
                    yield this.parseTree(page["children"], parentName === "icons" && page.type === "FRAME" ? "icons" : nameParts[0]);
                }
                const layer = page["children"] && page["children"].length > 0 ? page["children"][0] : page;
                const role = nameParts[0];

            //    console.log("role is!", role)
                if(page.name === "Create Account"){
                  console.log("Enter!!!", page)
                }

                if (page.type === "TEXT") {
                    const xPos = page.absoluteBoundingBox.x;
                    const yPos = page.absoluteBoundingBox.y;
                    const width = page.absoluteBoundingBox.width;
                    const height = page.absoluteBoundingBox.height;
                    const text = page.name;
                    const style = page.style.fontFamily;
                    const fontSize = page.style.fontSize;
                    this.output.content[contentCount] = {
                        xPos,
                        yPos,
                        width,
                        height,
                        text,
                        style,
                        fontSize
                    }
                    contentCount++;
                }
                /**
                 * Colors
                 */
                if (this.tokens.indexOf("colors") > -1 && layer["fills"]) {
                    const fill = layer["fills"][0];
                    // console.log("fill", layer["fills"][0])
                    const value = fill && fill.type && fill.type === "SOLID" ? (0, helpers_1.rgbaToStr)(fill.color, fill.opacity || 1) : null;
                    if (value) {
                        this.output.colors[nameParts.slice(1).join("")] = value;
                    }
                }
                /**
                 * Space
                 */
                if (this.tokens.indexOf("space") > -1 && layer["absoluteBoundingBox"]) {
                    this.output.space[`${nameParts.slice(1).join("")}`] = `${layer["absoluteBoundingBox"]["height"]}px`;
                }
                /**
                 * Font
                 */
                if (role === "font" && layer["style"]) {
                    if (this.tokens.indexOf("fonts") > -1 && nameParts[1] === "family") {
                        this.output.fonts[nameParts.length > 2 ? nameParts.slice(2).join("") : "default"] = layer["style"]["fontFamily"];
                    }
                    if (this.tokens.indexOf("fontSizes") > -1 && (nameParts[1] === "style" || nameParts[1] === "size")) {
                        this.output.fontSizes[nameParts.slice(2).join("")] = `${layer["style"]["fontSize"]}px`;
                    }
                    if (this.tokens.indexOf("lineHeights") > -1 && (nameParts[1] === "style" || nameParts[1] === "lineheight")) {
                        this.output.lineHeights[nameParts.slice(2).join("")] = `${layer["style"]["lineHeightPercentFontSize"]}%`;
                    }
                    if (this.tokens.indexOf("letterSpacings") > -1 && (nameParts[1] === "style" || nameParts[1] === "spacing")) {
                        this.output.letterSpacings[nameParts.slice(2).join("")] = `${Math.round((layer["style"]["letterSpacing"] / layer["style"]["fontSize"]) * 100) / 100}em`;
                    }
                    if (this.tokens.indexOf("fontWeights") > -1 && (nameParts[1] === "style" || nameParts[1] === "weight")) {
                        const fontWeight = layer["style"]["fontPostScriptName"].split("-").splice(-1, 1)[0].toLowerCase();
                        this.output.fontWeights[nameParts.slice(2).join("")] = helpers_1.fontWeights[fontWeight] || layer["style"]["fontWeight"].toString();
                    }
                    if (this.tokens.indexOf("textTransforms") > -1 && (nameParts[1] === "style" || nameParts[1] === "transform")) {
                        this.output.textTransforms[nameParts.slice(2).join("")] = layer["style"]["textCase"] === "UPPER" ? "uppercase" : "none";
                    }
                }
                /**
                 * Icon
                 */
                if (this.tokens.indexOf("icons") > -1 && page.type !== "FRAME" && ((role === "icon" && nameParts.length > 1) || parentName === "icons")) {
                    try {
                        const iconName = nameParts
                            .slice(parentName === "icons" ? 0 : 1)
                            .map((item) => item.charAt(0).toUpperCase() + item.substr(1).toLowerCase())
                            .join("");
                        const image = yield this.getImage(page.id);
                        const optimizedImage = (0, svgo_1.optimize)(image);
                        console.log(`Fetched icon ${iconName} type=${page.type}, original ${image.length}, optimized ${optimizedImage.data.length}`);
                        this.output.icons[iconName] = optimizedImage.data;
                    }
                    catch (err) { }
                }
                /**
                 * Illustration
                 */
                if (this.tokens.indexOf("illustrations") > -1 && ((role === "illustration" && nameParts.length > 1) || parentName === "illustrations")) {
                    console.log(role, nameParts, parentName);
                    try {
                        const illustrationName = nameParts
                            .slice(parentName === "illustrations" ? 0 : 1)
                            .map((item) => item.charAt(0).toUpperCase() + item.substr(1).toLowerCase())
                            .join("");
                        const image = yield this.getImage(page.id);
                        const optimizedImage = (0, svgo_1.optimize)(image);
                        console.log(`Fetched illustration ${illustrationName}, original ${image.length}, optimized ${optimizedImage.data.length}`);
                        this.output.illustrations[illustrationName] = optimizedImage.data;
                    }
                    catch (err) { }
                }
            }
        });
        this.client = axios_1.default.create({
            baseURL: `https://api.figma.com/v1/`,
            headers: {
                "X-Figma-Token": settings.token,
            },
        });
    }
}
module.exports = FigmaParser;
