export type ImportedPublicVideo = {
  uri: string;
  fileName: string;
  size: number;
};

export type ReelImporterModule = {
  downloadPublicVideo(url: string): Promise<ImportedPublicVideo>;
};

declare const module: ReelImporterModule;
export default module;
