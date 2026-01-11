module.exports = [
"[project]/node_modules/firebase/app/dist/index.mjs [app-ssr] (ecmascript, async loader)", ((__turbopack_context__) => {

__turbopack_context__.v((parentImport) => {
    return Promise.all([
  "server/chunks/ssr/node_modules_1d292d92._.js"
].map((chunk) => __turbopack_context__.l(chunk))).then(() => {
        return parentImport("[project]/node_modules/firebase/app/dist/index.mjs [app-ssr] (ecmascript)");
    });
});
}),
"[project]/node_modules/firebase/firestore/dist/index.mjs [app-ssr] (ecmascript, async loader)", ((__turbopack_context__) => {

__turbopack_context__.v((parentImport) => {
    return Promise.all([
  "server/chunks/ssr/node_modules_@grpc_grpc-js_c1502fba._.js",
  "server/chunks/ssr/node_modules_protobufjs_5977de25._.js",
  "server/chunks/ssr/node_modules_@firebase_firestore_dist_index_node_mjs_8bec9454._.js",
  "server/chunks/ssr/node_modules_7f2d89cc._.js",
  "server/chunks/ssr/[externals]__44cdd76e._.js"
].map((chunk) => __turbopack_context__.l(chunk))).then(() => {
        return parentImport("[project]/node_modules/firebase/firestore/dist/index.mjs [app-ssr] (ecmascript)");
    });
});
}),
"[project]/node_modules/firebase/auth/dist/index.mjs [app-ssr] (ecmascript, async loader)", ((__turbopack_context__) => {

__turbopack_context__.v((parentImport) => {
    return Promise.all([
  "server/chunks/ssr/node_modules_firebase_beb432ba._.js"
].map((chunk) => __turbopack_context__.l(chunk))).then(() => {
        return parentImport("[project]/node_modules/firebase/auth/dist/index.mjs [app-ssr] (ecmascript)");
    });
});
}),
"[project]/lib/firebase.ts [app-ssr] (ecmascript, async loader)", ((__turbopack_context__) => {

__turbopack_context__.v((parentImport) => {
    return Promise.resolve().then(() => {
        return parentImport("[project]/lib/firebase.ts [app-ssr] (ecmascript)");
    });
});
}),
];