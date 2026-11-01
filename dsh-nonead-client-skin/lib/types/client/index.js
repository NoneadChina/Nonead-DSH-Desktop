import { EXPANDED_LOGO_DATA_URL, RAIL_LOGO_DATA_URL } from "./assets.js";
export const name = 'dsh-nonead-client-skin';
/** 注入的 <style> 标签标识（幂等 + 卸载清理用）。 */
const STYLE_ID = 'dsh-skin-nonead-brand';
/** 展开态品牌 logo 渲染高度：对齐原 wordmark（svg 高 24px）。 */
const EXPANDED_HEIGHT_PX = 24;
/** 收起态 rail logo 渲染尺寸：对齐原 fish（svg 宽 24px）。 */
const RAIL_SIZE_PX = 24;
/** 组装覆盖样式：只换 logo + hero slogan，其余全部保持页面默认外观。 */
function buildCss() {
    return [
        /* ── 展开态：品牌区（含 mark + name 两个 slot）→ NONEAD_ai.png ── */
        'button:has([data-slot="sidebar.brand.name"]) {',
        `  background-image: url("${EXPANDED_LOGO_DATA_URL}") !important;`,
        '  background-repeat: no-repeat !important;',
        '  background-position: left center !important;',
        `  background-size: auto ${EXPANDED_HEIGHT_PX}px !important;`,
        '}',
        /* 隐藏原品牌内容（鲸鱼 mark + wordmark/文本），只留背景图 */
        'button:has([data-slot="sidebar.brand.name"]) [data-slot] {',
        '  display: none !important;',
        '}',
        '',
        /* ── 收起态：rail toggle（只有 mark slot，无 name slot）→ nonead.ai_Logo.png ── */
        'button:has([data-slot="sidebar.brand.mark"]):not(:has([data-slot="sidebar.brand.name"])) {',
        `  background-image: url("${RAIL_LOGO_DATA_URL}") !important;`,
        '  background-repeat: no-repeat !important;',
        '  background-position: center !important;',
        `  background-size: ${RAIL_SIZE_PX}px ${RAIL_SIZE_PX}px !important;`,
        '}',
        'button:has([data-slot="sidebar.brand.mark"]):not(:has([data-slot="sidebar.brand.name"])) [data-slot] {',
        '  display: none !important;',
        '}',
        /* hover 露出原展开面板图标时去掉背景图，避免图标与 logo 重叠 */
        'button:has([data-slot="sidebar.brand.mark"]):not(:has([data-slot="sidebar.brand.name"])):hover {',
        '  background-image: none !important;',
        '}',
        '',
        /* ── 首页 Hero：输入框上方的 fish logo → nonead.ai_Logo.png ── */
        '[data-slot="conversation.hero.brand.mark"] {',
        `  background-image: url("${RAIL_LOGO_DATA_URL}") !important;`,
        '  background-repeat: no-repeat !important;',
        '  background-position: center !important;',
        '  background-size: contain !important;',
        '  display: inline-flex !important;',
        '  align-items: center !important;',
        '  justify-content: center !important;',
        '  width: 34px !important;',
        '  height: 34px !important;',
        '}',
        '[data-slot="conversation.hero.brand.mark"] svg {',
        '  display: none !important;',
        '}',
    ].join('\n');
}
/** 将 hero 区 headline "探索未至之境 / Into the Unknown" 替换为指定中文。 */
const HEADLINE_FROM_ZH = '探索未至之境';
const HEADLINE_FROM_EN = 'Into the Unknown';
const HEADLINE_TO = '创新改变世界';
/** 已替换过的元素做标记，避免反复触发。 */
const REPLACED_FLAG = 'data-dsh-skin-nonead-headline-replaced';
/** 递归扫描并替换匹配的文本节点。 */
function replaceHeadlineIn(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
            if (node.parentNode?.nodeType === 1) {
                const host = node.parentNode;
                if (host.getAttribute(REPLACED_FLAG) === '1')
                    return NodeFilter.FILTER_REJECT;
            }
            const t = node.nodeValue ?? '';
            if (t === HEADLINE_FROM_ZH || t === HEADLINE_FROM_EN)
                return NodeFilter.FILTER_ACCEPT;
            return NodeFilter.FILTER_SKIP;
        },
    });
    const hits = [];
    let cur;
    while ((cur = walker.nextNode()) !== null)
        hits.push(cur);
    for (const t of hits) {
        t.nodeValue = HEADLINE_TO;
        const host = t.parentNode;
        if (host && host.nodeType === 1)
            host.setAttribute(REPLACED_FLAG, '1');
    }
}
export function apply(ctx) {
    if (typeof document === 'undefined')
        return;
    // 幂等：重复执行（HMR 重放 / 插件重启）时不再叠加第二个标签。
    if (document.querySelector(`style[data-plugin-css="${STYLE_ID}"]`) !== null)
        return;
    const tag = document.createElement('style');
    tag.dataset.pluginCss = STYLE_ID;
    tag.textContent = buildCss();
    document.head.appendChild(tag);
    // 卸载时移除，保证皮肤完整还原。
    ctx.effect(() => () => { tag.remove(); }, 'dsh-skin-nonead: teardown');
    // ── hero slogan 文本替换（初始 + 后续 DOM 变化） ──
    replaceHeadlineIn(document.body);
    const headlineObserver = new MutationObserver((records) => {
        for (const r of records) {
            if (r.type === 'characterData') {
                const host = r.target.parentNode;
                if (host && host.getAttribute(REPLACED_FLAG) === '1')
                    continue;
                replaceHeadlineIn(r.target);
            }
            else {
                for (const n of r.addedNodes)
                    replaceHeadlineIn(n);
            }
        }
    });
    headlineObserver.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
    });
    ctx.effect(() => () => { headlineObserver.disconnect(); }, 'dsh-skin-nonead: headline observer teardown');
}
//# sourceMappingURL=index.js.map