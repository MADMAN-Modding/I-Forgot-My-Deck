
const dev: boolean = import.meta.env.DEV

export const WSS_URL: String = dev ? "127.0.0.1:3000" : "ifmd-api.madtechs.dev"
