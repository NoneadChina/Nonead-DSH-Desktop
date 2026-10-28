/** Built-in Desktop languages, the native-menu copy and the locale resolver. */
import { normalizeDesktopLocale, preferredDesktopLocale, type DesktopLocale } from './desktop-i18n.ts'

const en = { application: 'Application', edit: 'Edit', menuBar: 'Application menu',
  undo: 'Undo', redo: 'Redo', cut: 'Cut', copy: 'Copy', paste: 'Paste', delete: 'Delete', selectAll: 'Select All' }
const zh: typeof en = { application: '应用', edit: '编辑', menuBar: '应用菜单',
  undo: '撤销', redo: '重做', cut: '剪切', copy: '复制', paste: '粘贴', delete: '删除', selectAll: '全选' }
const ja: typeof en = { application: 'アプリケーション', edit: '編集', menuBar: 'アプリケーションメニュー',
  undo: '取り消す', redo: 'やり直す', cut: '切り取る', copy: 'コピー', paste: '貼り付け', delete: '削除', selectAll: 'すべて選択' }
const es: typeof en = { application: 'Aplicación', edit: 'Edición', menuBar: 'Menú de la aplicación',
  undo: 'Deshacer', redo: 'Rehacer', cut: 'Cortar', copy: 'Copiar', paste: 'Pegar', delete: 'Eliminar', selectAll: 'Seleccionar todo' }
const fr: typeof en = { application: 'Application', edit: 'Édition', menuBar: 'Menu de l’application',
  undo: 'Annuler', redo: 'Rétablir', cut: 'Couper', copy: 'Copier', paste: 'Coller', delete: 'Supprimer', selectAll: 'Tout sélectionner' }
const de: typeof en = { application: 'Anwendung', edit: 'Bearbeiten', menuBar: 'Anwendungsmenü',
  undo: 'Rückgängig', redo: 'Wiederholen', cut: 'Ausschneiden', copy: 'Kopieren', paste: 'Einfügen', delete: 'Löschen', selectAll: 'Alles auswählen' }
const ru: typeof en = { application: 'Приложение', edit: 'Правка', menuBar: 'Меню приложения',
  undo: 'Отменить', redo: 'Повторить', cut: 'Вырезать', copy: 'Копировать', paste: 'Вставить', delete: 'Удалить', selectAll: 'Выделить все' }
const pt: typeof en = { application: 'Aplicativo', edit: 'Editar', menuBar: 'Menu do aplicativo',
  undo: 'Desfazer', redo: 'Refazer', cut: 'Recortar', copy: 'Copiar', paste: 'Colar', delete: 'Excluir', selectAll: 'Selecionar tudo' }

/** Native-menu copy per shell language. */
const MESSAGES: Record<DesktopLocale, typeof en> = { zh, en, ja, es, fr, de, ru, pt }

export { preferredDesktopLocale }

/** Resolve the menu copy for a locale tag, falling back to English. */
export function resolveDesktopLocale(language: string) {
  return { messages: MESSAGES[normalizeDesktopLocale(language) ?? 'en'] }
}
