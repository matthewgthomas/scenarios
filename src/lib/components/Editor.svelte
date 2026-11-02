<script lang="ts">
  import { onMount } from 'svelte';
  import { Editor } from '@tiptap/core';
  import StarterKit from '@tiptap/starter-kit';
  import { Markdown } from '@tiptap/markdown';
  import { Bold, Italic, Heading2, List, Quote } from '@lucide/svelte';
  let { value, onedit }: { value: string; onedit: (text: string) => void } = $props();
  let element: HTMLDivElement;
  let editor = $state<Editor>();
  onMount(() => {
    editor = new Editor({
      element,
      extensions: [StarterKit.configure({ link: false, underline: false }), Markdown],
      content: value,
      contentType: 'markdown',
      editorProps: {
        attributes: {
          role: 'textbox',
          'aria-label': 'Scenario narrative',
          'aria-multiline': 'true'
        }
      },
      onUpdate: ({ editor }) => onedit(editor.getMarkdown())
    });
    return () => editor?.destroy();
  });
  $effect(() => {
    if (editor && value !== editor.getMarkdown())
      editor.commands.setContent(value, { contentType: 'markdown', emitUpdate: false });
  });
</script>

<div class="rich-editor">
  <div class="editor-toolbar" aria-label="Text formatting">
    <button
      class="icon-button"
      aria-label="Bold"
      title="Bold"
      onclick={() => editor?.chain().focus().toggleBold().run()}><Bold size={17} /></button
    ><button
      class="icon-button"
      aria-label="Italic"
      title="Italic"
      onclick={() => editor?.chain().focus().toggleItalic().run()}><Italic size={17} /></button
    ><button
      class="icon-button"
      aria-label="Heading"
      title="Heading"
      onclick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
      ><Heading2 size={17} /></button
    ><button
      class="icon-button"
      aria-label="Bullet list"
      title="Bullet list"
      onclick={() => editor?.chain().focus().toggleBulletList().run()}><List size={17} /></button
    ><button
      class="icon-button"
      aria-label="Block quote"
      title="Block quote"
      onclick={() => editor?.chain().focus().toggleBlockquote().run()}><Quote size={17} /></button
    >
  </div>
  <div bind:this={element}></div>
</div>
