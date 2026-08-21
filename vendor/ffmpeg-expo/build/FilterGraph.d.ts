export type FilterOptionValue = string | number | boolean;
export type FilterOptions = readonly FilterOptionValue[] | Readonly<Record<string, FilterOptionValue | undefined>>;
export interface FilterSpec {
    /** FFmpeg filter name, for example `scale` or `overlay`. */
    name: string;
    /** Positional values or named filter options. */
    options?: FilterOptions;
}
export interface FilterChainSpec {
    /** Input link labels without surrounding brackets. */
    inputs?: string | readonly string[];
    /** One or more filters joined into the same filterchain. */
    filters: FilterSpec | readonly FilterSpec[];
    /** Output link labels without surrounding brackets. */
    outputs?: string | readonly string[];
}
/** Builds an FFmpeg complex filtergraph without shell quoting. */
export declare class FilterGraphBuilder {
    private readonly chains;
    /** Add a typed filterchain to the graph. */
    addChain(chain: FilterChainSpec): this;
    /**
     * Add a complete filterchain without validation or escaping.
     *
     * Use this only when the typed representation cannot express the graph.
     */
    addRawChain(fragment: string): this;
    /** Build the value passed to FFmpeg's `-filter_complex` option. */
    build(): string;
    /** Build argv entries that can be spread into `run` or `execute`. */
    buildArgs(): string[];
}
//# sourceMappingURL=FilterGraph.d.ts.map