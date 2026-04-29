import {
  STORAGE_KEY,
  getEnabledSites,
  isSiteEnabled,
  normalizeSites,
} from '@/utils/site-settings';

const SUPPORTED_INPUT_TYPES = new Set(['', 'text', 'search', 'url', 'tel', 'password']);
const INIT_FLAG = '__cleanPasteInitialized__';

declare global {
  interface Window {
    __cleanPasteInitialized__?: boolean;
  }
}

type EditableTarget =
  | { kind: 'text-control'; element: HTMLInputElement | HTMLTextAreaElement }
  | { kind: 'contenteditable'; element: HTMLElement };

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_start',
  main() {
    if (window[INIT_FLAG]) {
      return;
    }

    window[INIT_FLAG] = true;
    let enabledSites: string[] = [];

    const refreshEnabledSites = async () => {
      enabledSites = await getEnabledSites();
    };

    void refreshEnabledSites();

    browser.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'sync' || !changes[STORAGE_KEY]) {
        return;
      }

      enabledSites = normalizeSites(changes[STORAGE_KEY].newValue);
    });

    document.addEventListener(
      'paste',
      (event) => {
        if (!isSiteEnabled(enabledSites, window.location.origin)) {
          return;
        }

        const editableTarget = findEditableTarget(event);

        if (!editableTarget) {
          return;
        }

        const clipboardData = event.clipboardData;

        if (
          !clipboardData ||
          !Array.from(clipboardData.types).includes('text/plain')
        ) {
          return;
        }

        const plainText = clipboardData.getData('text/plain');
        event.preventDefault();
        event.stopImmediatePropagation();
        event.stopPropagation();

        if (editableTarget.kind === 'text-control') {
          insertIntoTextControl(editableTarget.element, plainText);
          return;
        }

        insertIntoContentEditable(editableTarget.element, plainText);
      },
      true,
    );
  },
});

function findEditableTarget(event: ClipboardEvent): EditableTarget | null {
  const path = event.composedPath();

  for (const item of path) {
    if (item instanceof HTMLTextAreaElement && isEditableTextArea(item)) {
      return { kind: 'text-control', element: item };
    }

    if (item instanceof HTMLInputElement && isEditableInput(item)) {
      return { kind: 'text-control', element: item };
    }

    if (item instanceof HTMLElement && item.isContentEditable) {
      return { kind: 'contenteditable', element: item };
    }
  }

  const activeElement = document.activeElement;

  if (activeElement instanceof HTMLTextAreaElement && isEditableTextArea(activeElement)) {
    return { kind: 'text-control', element: activeElement };
  }

  if (activeElement instanceof HTMLInputElement && isEditableInput(activeElement)) {
    return { kind: 'text-control', element: activeElement };
  }

  if (activeElement instanceof HTMLElement && activeElement.isContentEditable) {
    return { kind: 'contenteditable', element: activeElement };
  }

  return null;
}

function isEditableInput(element: HTMLInputElement): boolean {
  return (
    !element.disabled &&
    !element.readOnly &&
    SUPPORTED_INPUT_TYPES.has(element.type.toLowerCase())
  );
}

function isEditableTextArea(element: HTMLTextAreaElement): boolean {
  return !element.disabled && !element.readOnly;
}

function insertIntoTextControl(
  element: HTMLInputElement | HTMLTextAreaElement,
  text: string,
) {
  element.focus();

  const selectionStart = element.selectionStart ?? element.value.length;
  const selectionEnd = element.selectionEnd ?? selectionStart;

  element.setRangeText(text, selectionStart, selectionEnd, 'end');
  dispatchInputEvent(element, text);
}

function insertIntoContentEditable(element: HTMLElement, text: string) {
  element.focus();

  if (document.queryCommandSupported?.('insertText')) {
    const inserted = document.execCommand('insertText', false, text);

    if (inserted) {
      return;
    }
  }

  const selection = window.getSelection();

  if (!selection || selection.rangeCount === 0) {
    return;
  }

  const range = selection.getRangeAt(0);
  range.deleteContents();

  const fragment = document.createDocumentFragment();
  const lines = text.split(/\r?\n/);

  lines.forEach((line, index) => {
    if (index > 0) {
      fragment.append(document.createElement('br'));
    }

    if (line) {
      fragment.append(document.createTextNode(line));
    }
  });

  if (text.endsWith('\n')) {
    fragment.append(document.createElement('br'));
  }

  const lastNode = fragment.lastChild;
  range.insertNode(fragment);

  if (lastNode) {
    range.setStartAfter(lastNode);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  dispatchInputEvent(element, text);
}

function dispatchInputEvent(element: HTMLElement, text: string) {
  element.dispatchEvent(
    new InputEvent('input', {
      bubbles: true,
      data: text,
      inputType: 'insertFromPaste',
    }),
  );
}
