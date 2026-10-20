"use client";

import { useEffect, useRef } from "react";
import { EditorState, Compartment, type Extension } from "@codemirror/state";
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  drawSelection,
  dropCursor,
  rectangularSelection,
  crosshairCursor,
  placeholder as placeholderExt,
} from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import {
  bracketMatching,
  foldGutter,
  indentOnInput,
  syntaxHighlighting,
  HighlightStyle,
  indentUnit,
} from "@codemirror/language";
import { closeBrackets, closeBracketsKeymap, autocompletion, completionKeymap } from "@codemirror/autocomplete";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { tags as t } from "@lezer/highlight";
import { MODE_LOADERS } from "./languages";

const highlight = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.moduleKeyword, t.operatorKeyword, t.definitionKeyword, t.modifier], color: "var(--syn-keyword)" },
  { tag: [t.string, t.special(t.string), t.regexp, t.character], color: "var(--syn-string)" },
  { tag: [t.number, t.bool, t.null, t.atom], color: "var(--syn-number)" },
  { tag: [t.comment, t.lineComment, t.blockComment, t.docComment], color: "var(--syn-comment)", fontStyle: "italic" },
  { tag: [t.function(t.variableName), t.function(t.propertyName), t.macroName], color: "var(--syn-function)" },
  { tag: [t.typeName, t.className, t.namespace, t.standard(t.typeName)], color: "var(--syn-type)" },
  { tag: [t.standard(t.variableName), t.self], color: "var(--syn-builtin)" },
  { tag: [t.propertyName, t.attributeName], color: "var(--syn-property)" },
  { tag: [t.operator, t.punctuation, t.separator, t.bracket], color: "var(--syn-operator)" },
  { tag: [t.meta, t.processingInstruction], color: "var(--syn-meta)" },
  { tag: t.invalid, color: "var(--red)" },
]);

const baseTheme = EditorView.theme({
  "&": { color: "var(--ink)", backgroundColor: "var(--editor-bg)" },
  ".cm-content": { caretColor: "var(--ink)", padding: "10px 0" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--ink)", borderLeftWidth: "2px" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
    backgroundColor: "var(--sel) !important",
  },
  ".cm-gutters": {
    backgroundColor: "var(--editor-bg)",
    color: "var(--ink-4)",
    border: "none",
    paddingLeft: "6px",
  },
  ".cm-lineNumbers .cm-gutterElement": { padding: "0 10px 0 6px", minWidth: "32px" },
  ".cm-activeLine": { backgroundColor: "var(--editor-active)" },
  ".cm-activeLineGutter": { backgroundColor: "transparent", color: "var(--ink-2)" },
  ".cm-matchingBracket": { backgroundColor: "var(--sel)", outline: "none" },
  ".cm-foldGutter .cm-gutterElement": { color: "var(--ink-4)" },
  ".cm-tooltip": {
    border: "1px solid var(--line)",
    backgroundColor: "var(--panel)",
    borderRadius: "6px",
    boxShadow: "var(--shadow-pop)",
  },
  ".cm-tooltip-autocomplete > ul > li[aria-selected]": { backgroundColor: "var(--panel-3)", color: "var(--ink)" },
  ".cm-panels": { backgroundColor: "var(--panel-2)", color: "var(--ink)", borderColor: "var(--line)" },
  ".cm-searchMatch": { backgroundColor: "var(--amber-soft)" },
  ".cm-placeholder": { color: "var(--ink-4)" },
});

export type CodeEditorProps = {
  value: string;
  onChange?: (v: string) => void;
  mode?: string;
  readOnly?: boolean;
  placeholder?: string;
  lineNumbers?: boolean;
  minimal?: boolean;
  tabSize?: number;
  onPaste?: (text: string) => void;
  onCopy?: (text: string) => void;
  className?: string;
  autoFocus?: boolean;
  onSubmitShortcut?: () => void;
  onRunShortcut?: () => void;
};

export function CodeEditor({
  value,
  onChange,
  mode = "text",
  readOnly,
  placeholder,
  lineNumbers: showNumbers = true,
  minimal,
  tabSize = 4,
  onPaste,
  onCopy,
  className,
  autoFocus,
  onSubmitShortcut,
  onRunShortcut,
}: CodeEditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const lang = useRef(new Compartment());
  const ro = useRef(new Compartment());
  const cb = useRef({ onChange, onPaste, onCopy, onSubmitShortcut, onRunShortcut });
  cb.current = { onChange, onPaste, onCopy, onSubmitShortcut, onRunShortcut };

  useEffect(() => {
    if (!host.current) return;
    const extensions: Extension[] = [
      history(),
      drawSelection(),
      dropCursor(),
      indentOnInput(),
      bracketMatching(),
      closeBrackets(),
      autocompletion({ activateOnTyping: true }),
      rectangularSelection(),
      crosshairCursor(),
      highlightSelectionMatches(),
      syntaxHighlighting(highlight),
      EditorState.tabSize.of(tabSize),
      indentUnit.of(" ".repeat(tabSize)),
      keymap.of([
        {
          key: "Mod-Enter",
          run: () => {
            cb.current.onRunShortcut?.();
            return Boolean(cb.current.onRunShortcut);
          },
        },
        {
          key: "Mod-Shift-Enter",
          run: () => {
            cb.current.onSubmitShortcut?.();
            return Boolean(cb.current.onSubmitShortcut);
          },
        },
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...searchKeymap,
        ...historyKeymap,
        ...completionKeymap,
        indentWithTab,
      ]),
      baseTheme,
      EditorView.updateListener.of((u) => {
        if (u.docChanged) cb.current.onChange?.(u.state.doc.toString());
      }),
      EditorView.domEventHandlers({
        paste(e) {
          const text = e.clipboardData?.getData("text/plain") ?? "";
          cb.current.onPaste?.(text);
          return false;
        },
        copy(_e, v) {
          const sel = v.state.sliceDoc(v.state.selection.main.from, v.state.selection.main.to);
          cb.current.onCopy?.(sel);
          return false;
        },
      }),
      lang.current.of([]),
      ro.current.of(EditorState.readOnly.of(Boolean(readOnly))),
    ];
    if (!minimal) extensions.push(highlightActiveLine(), highlightActiveLineGutter(), foldGutter());
    if (showNumbers) extensions.push(lineNumbers());
    if (placeholder) extensions.push(placeholderExt(placeholder));
    const v = new EditorView({ parent: host.current, state: EditorState.create({ doc: value, extensions }) });
    view.current = v;
    if (autoFocus) v.focus();
    return () => {
      v.destroy();
      view.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = MODE_LOADERS[mode] ?? MODE_LOADERS.text;
    load().then((ext) => {
      if (!cancelled && view.current) view.current.dispatch({ effects: lang.current.reconfigure(ext) });
    });
    return () => {
      cancelled = true;
    };
  }, [mode]);

  useEffect(() => {
    view.current?.dispatch({ effects: ro.current.reconfigure(EditorState.readOnly.of(Boolean(readOnly))) });
  }, [readOnly]);

  // External value changes (template reset, loading a draft) replace the document.
  useEffect(() => {
    const v = view.current;
    if (v && v.state.doc.toString() !== value) {
      v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } });
    }
  }, [value]);

  return <div ref={host} className={className} data-editor />;
}
