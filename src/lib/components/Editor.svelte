<script lang="ts">
  import { onMount } from 'svelte';
  import { Editor } from '@tiptap/core';
  import StarterKit from '@tiptap/starter-kit';
  import { Markdown } from '@tiptap/markdown';
  import { Bold, Italic, Heading2, List, Quote } from '@lucide/svelte';
  const formatting = [
    {
      label: 'Bold',
      Icon: Bold,
      apply: (editor: Editor) => editor.chain().focus().toggleBold().run()
    },
    {
      label: 'Italic',
      Icon: Italic,
      apply: (editor: Editor) => editor.chain().focus().toggleItalic().run()
    },
    {
      label: 'Heading',
      Icon: Heading2,
      apply: (editor: Editor) => editor.chain().focus().toggleHeading({ level: 2 }).run()
    },
    {
      label: 'Bullet list',
      Icon: List,
      apply: (editor: Editor) => editor.chain().focus().toggleBulletList().run()
    },
    {
      label: 'Block quote',
      Icon: Quote,
      apply: (editor: Editor) => editor.chain().focus().toggleBlockquote().run()
    }
  ];
  let {
    value,
    onedit,
    editable = true
  }: { value: string; onedit: (text: string) => void; editable?: boolean } = $props();
  let element: HTMLDivElement;
  let editor = $state<Editor>();
  onMount(() => {
    editor = new Editor({
      element,
      editable,
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
    if (editor && editor.isEditable !== editable) editor.setEditable(editable);
    if (editor && value !== editor.getMarkdown())
      editor.commands.setContent(value, { contentType: 'markdown', emitUpdate: false });
  });
</script>

<div class="rich-editor">
  <div class="editor-toolbar" aria-label="Text formatting">
    {#each formatting as { label, Icon, apply }}
      <button
        class="icon-button"
        aria-label={label}
        title={label}
        onclick={() => editor && apply(editor)}><Icon size={17} /></button
      >
    {/each}
  </div>
  <div bind:this={element}></div>
</div>
