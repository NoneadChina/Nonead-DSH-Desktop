/**
 * 品牌皮肤插件：Nonead 侧边栏 logo 替换（其余外观与默认页面完全一致）。
 *
 * 原理：侧边栏的两个 logo 是 ui-sidebar 的 SidebarRoot 通过 slot 渲染的
 * （`sidebar.brand.mark` / `sidebar.brand.name`），每个 slot 出口都带一个稳定的
 * `[data-slot="<key>"]` 包装元素（ui-renderer 的 scoped-slots 约定：这是动态样式
 * 定位的「可寻址接缝」），所以本插件用注入的 CSS 按 slot 定位、盖掉原内容，
 * 改成用户提供的 PNG：
 *
 * - 展开态：导航栏上部的品牌区（brand 按钮，内含 mark + name 两个 slot）
 *   → NONEAD_ai.png（1790×200 横版，按原 wordmark 高度 24px 渲染，宽自动等比）。
 * - 收起态：rail 顶部的 toggle 按钮（只含 mark slot，无 name slot）
 *   → nonead.ai_Logo.png（486×486 方形，按 24px 渲染）；hover 时保持原交互
 *   （露出展开面板图标、隐藏背景图）。
 *
 * 选择器按 slot 键（`[data-slot="sidebar.brand.mark"]` /
 * `[data-slot="sidebar.brand.name"]`）定位，不依赖 CSS-module 的哈希类名，也不依赖
 * 具体 SVG 的 viewBox，跨构建稳定；且限定在 button 内，不会误伤
 * EmptyHero（空会话页）等其它使用 FishLogo 的位置。
 *
 * 两张图片以 base64 data URL 内嵌（见同目录 assets.ts，构建期脚本生成），
 * 不依赖任何静态文件路由。样式注入到 <head>，插件卸载时移除。
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
export declare const name = "dsh-nonead-client-skin";
export declare function apply(ctx: ClientContext): void;
//# sourceMappingURL=index.d.ts.map