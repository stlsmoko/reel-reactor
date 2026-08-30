"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FilterGraphBuilder = void 0;
const FILTER_NAME_DELIMITERS = /[\s\[\],;:=\\']/;
const OPTION_NAME_DELIMITERS = /[\s\[\],;:=\\']/;
const LABEL_DELIMITERS = /[\[\]]/;
const OPTION_VALUE_ESCAPE_CHARACTERS = new Set([
    '\\',
    "'",
    ':',
]);
const GRAPH_VALUE_ESCAPE_CHARACTERS = new Set([
    '\\',
    "'",
    '[',
    ']',
    ',',
    ';',
]);
function normalizeList(value) {
    return Array.isArray(value) ? value : [value];
}
function validateToken(value, description, invalidCharacters) {
    if (value.length === 0 || value.trim() !== value) {
        throw new TypeError(`${description} must be a non-empty, unpadded string`);
    }
    if (invalidCharacters.test(value)) {
        throw new TypeError(`${description} contains an FFmpeg delimiter`);
    }
}
function escapeCharacters(value, characters) {
    let escaped = '';
    for (const character of value) {
        if (characters.has(character)) {
            escaped += '\\';
        }
        escaped += character;
    }
    return escaped;
}
function serializeOptionValue(value) {
    if (typeof value === 'number' && !Number.isFinite(value)) {
        throw new TypeError('Filter option numbers must be finite');
    }
    // Filter values are parsed once as option values and again as part of the
    // containing graph, so each parser's delimiters need their own escaping.
    const optionEscaped = escapeCharacters(String(value), OPTION_VALUE_ESCAPE_CHARACTERS);
    return escapeCharacters(optionEscaped, GRAPH_VALUE_ESCAPE_CHARACTERS);
}
function serializeOptions(options) {
    if (Array.isArray(options)) {
        return options.map(serializeOptionValue).join(':');
    }
    return Object.entries(options)
        .filter((entry) => entry[1] !== undefined)
        .map(([name, value]) => {
        validateToken(name, 'Filter option name', OPTION_NAME_DELIMITERS);
        return `${name}=${serializeOptionValue(value)}`;
    })
        .join(':');
}
function serializeFilter(filter) {
    validateToken(filter.name, 'Filter name', FILTER_NAME_DELIMITERS);
    if (filter.options === undefined) {
        return filter.name;
    }
    const options = serializeOptions(filter.options);
    return options.length > 0 ? `${filter.name}=${options}` : filter.name;
}
function serializeLabels(labels) {
    return normalizeList(labels)
        .map((label) => {
        validateToken(label, 'Filter link label', LABEL_DELIMITERS);
        return `[${label}]`;
    })
        .join('');
}
/** Builds an FFmpeg complex filtergraph without shell quoting. */
class FilterGraphBuilder {
    constructor() {
        this.chains = [];
    }
    /** Add a typed filterchain to the graph. */
    addChain(chain) {
        const filters = normalizeList(chain.filters);
        if (filters.length === 0) {
            throw new TypeError('Filter chain must contain at least one filter');
        }
        const inputs = chain.inputs === undefined ? '' : serializeLabels(chain.inputs);
        const outputs = chain.outputs === undefined ? '' : serializeLabels(chain.outputs);
        const serializedFilters = filters.map(serializeFilter).join(',');
        this.chains.push(`${inputs}${serializedFilters}${outputs}`);
        return this;
    }
    /**
     * Add a complete filterchain without validation or escaping.
     *
     * Use this only when the typed representation cannot express the graph.
     */
    addRawChain(fragment) {
        const chain = fragment.trim();
        if (chain.length === 0) {
            throw new TypeError('Raw filter chain must not be empty');
        }
        this.chains.push(chain);
        return this;
    }
    /** Build the value passed to FFmpeg's `-filter_complex` option. */
    build() {
        if (this.chains.length === 0) {
            throw new Error('Cannot build an empty filtergraph');
        }
        return this.chains.join(';');
    }
    /** Build argv entries that can be spread into `run` or `execute`. */
    buildArgs() {
        return ['-filter_complex', this.build()];
    }
}
exports.FilterGraphBuilder = FilterGraphBuilder;
//# sourceMappingURL=FilterGraph.js.map