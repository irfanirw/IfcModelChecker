/// <reference types="vite/client" />

declare module 'web-ifc' {
    export const IfcAPI: any;
    export const IFCWALL: number;
    export const IFCDOOR: number;
    export const IFCWINDOW: number;
    export const IFCSLAB: number;
    export const IFCBEAM: number;
    export const IFCCOLUMN: number;
    export const IFCROOF: number;
    export const IFCSTAIR: number;
    export const IFCRAILING: number;
    export const IFCCURTAINWALL: number;
    export const IFCSPACE: number;
    export const IFCBUILDINGSTOREY: number;
    export const IFCBUILDING: number;
    export const IFCSITE: number;
    export const IFCPROJECT: number;
    export const IFCFOOTING: number;
    export const IFCPILE: number;
    export const IFCREINFORCINGBAR: number;
    export const IFCPIPESEGMENT: number;
    export const IFCDUCTSEGMENT: number;
    export const IFCFLOWTERMINAL: number;
    export const IFCFLOWFITTING: number;
    export const IFCRELDEFINESBYPROPERTIES: number;
    export const IFCPROPERTYSET: number;
    export const IFCPROPERTYSINGLEVALUE: number;
    export const IFCRELCONTAINEDINSPATIALSTRUCTURE: number;
    export const IFCRELAGGREGATES: number;
}

declare module '*.wasm' {
    const content: string;
    export default content;
}

declare module 'comlink' {
    export function wrap<T>(port: MessagePort | Worker): T;
    export function expose(obj: any, ep?: MessagePort | Worker): void;
    export function transfer<T>(obj: T, transferables: Transferable[]): T;
    export function proxy<T extends Function>(callback: T): T;
}
