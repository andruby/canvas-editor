import Ember from 'ember';
import layout from './template';
import ChecklistItem from 'canvas-editor/lib/realtime-canvas/checklist-item';
import Paragraph from 'canvas-editor/lib/realtime-canvas/paragraph';
import Rangy from 'rangy';
import Selection from 'canvas-editor/lib/selection';
import SelectionState from 'canvas-editor/lib/selection-state';
import List from 'canvas-editor/lib/realtime-canvas/list';
import UnorderedListItem from 'canvas-editor/lib/realtime-canvas/unordered-list-item';
import styles from './styles';

const { run } = Ember;

/**
 * A component that allows for the editing of a canvas in realtime.
 *
 * @class CanvasEditor.CanvasEditorComponent
 * @extends Ember.Component
 */
export default Ember.Component.extend({
  classNames: ['canvas-editor'],
  localClassNames: ['component'],
  layout,
  styles,

  didInsertElement() {
    this.focusBlockStart(this.get('canvas.blocks.firstObject'));
  },

  /**
   * A dummy handler for an action that receives a block after it was udpated
   * locally.
   *
   * @method
   * @param {CanvasEditor.RealtimeCanvas.Block} block The updated block
   */
  onBlockContentUpdatedLocally: Ember.K,

  /**
   * A dummy handler for an action that receives a block, meta path, old value,
   * and new value when the value was replaced.
   *
   * @method
   * @param {CanvasEditor.CanvasRealtime.Block} block The block whose meta
   *   was updated locally
   * @param {Array<*>} metaPath The path to the updated meta property
   * @param {*} oldValue The old meta value
   * @param {*} newValue The new meta value
   */
  onBlockMetaReplacedLocally: Ember.K,

  /**
   * A dummy handler for an action that receives an index in the block's parent
   * and a block after the block was deleted locally.
   *
   * @method
   * @param {number} index The index the block was deleted from in its parent
   * @param {CanvasEditor.RealtimeCanvas.Block} block The deleted block
   */
  onBlockDeletedLocally: Ember.K,

  /**
   * A dummy handler for an action that receives an index and a block after the
   * block was inserted locally.
   *
   * @method
   * @param {number} index The index the new block was inserted at in its parent
   * @param {CanvasEditor.RealtimeCanvas.Block} newBlock The new block
   */
  onNewBlockInsertedLocally: Ember.K,

  /**
   * A dummy handler for an action that receives a replaced block and a block
   * to replace it.
   *
   * @method
   * @param {number} index The index of the replaced block
   * @param {CanvasEditor.RealtimeCanvas.Block} block The replaced block
   * @param {CanvasEditor.RealtimeCanvas.Block} newBlock The replacing block
   */
  onBlockReplacedLocally: Ember.K,

  /**
   * A dummy handler for a function that is passed in in order to unfurl a
   * block.
   *
   * @method
   * @param {CanvasEditor.RealtimeCanvas.Block} block The block to unfurl
   */
  unfurlBlock() { return Ember.RSVP.resolve({}); },

  /**
   * Focus at the end of the element that represents the block with the given
   * ID.
   *
   * @method focusBlockEnd
   * @param {CanvasEditor.CanvasRealtime.Block} block The block to find and
   *   focus the element for
   */
  focusBlockEnd(block) {
    const $block = this.$(`[data-block-id="${block.get('id')}"]`);
    const range = Rangy.createRange();
    range.selectNodeContents($block.get(0));
    range.collapse(false /* collapse to end */);
    Rangy.getSelection().setSingleRange(range);
    $block.focus();
  },

  /**
   * Focus at the beginning of the element that represents the block with the
   * given ID.
   *
   * @method focusBlockStart
   * @param {CanvasEditor.CanvasRealtime.Block} block The block to find and
   *   focus the element for
   */
  focusBlockStart(block) {
    let $block = this.$(`[data-block-id="${block.get('id')}"]`);
    const $editableContent = $block.find('.editable-content');
    if ($editableContent.length) $block = $editableContent;
    const range = Rangy.createRange();
    range.setStart($block.get(0), 0);
    Rangy.getSelection().setSingleRange(range);
    $block.focus();
  },

  /**
   * Return the list of navigable blocks, which excludes groups.
   *
   * @method
   * @returns {Array<CanvasEditor.CanvasRealtime.Block}
   */
  getNavigableBlocks() {
    return Ember.A([].concat(...this.get('canvas.blocks').map(block => {
      if (block.get('isGroup')) {
        return block.get('blocks');
      }

      return block;
    })));
  },

  /**
   * Remove a group from the canvas if it is empty.
   *
   * @method
   * @param {CanvasEditor.CanvasRealtime.GroupBlock} group The group that will
   *   be removed if empty
   */
  removeGroupIfEmpty(group) {
    if (group.get('blocks.length') > 0) return;
    const index = this.get('canvas.blocks').indexOf(group);
    this.get('canvas.blocks').removeObject(group);
    this.get('onBlockDeletedLocally')(index, group);
  },

  /**
   * Split a block's group at the block, replacing it with a paragraph.
   *
   * @method
   * @param {CanvasEditor.CanvasRealtime.Block} block The block whose group will
   *   be split
   * @param {string} content The content for the new block created for the split
   */
  splitGroupAtMember(block, content) {
    const group = block.get('parent');
    const index = group.get('blocks').indexOf(block);
    const groupIndex = this.get('canvas.blocks').indexOf(group);
    const movedGroupBlocks = Ember.A(group.get('blocks').slice(index + 1));

    movedGroupBlocks.forEach(movedGroupBlock => {
      this.get('onBlockDeletedLocally')(index + 1, movedGroupBlock);
    });

    const newGroup = group.constructor.create({ blocks: movedGroupBlocks });

    group.get('blocks').replace(index, Infinity, []);
    this.get('onBlockDeletedLocally')(index, block);

    const paragraph = Paragraph.create({ id: block.get('id'), content });
    this.get('canvas.blocks').replace(groupIndex + 1, 0, [paragraph]);
    this.get('onNewBlockInsertedLocally')(groupIndex + 1, paragraph);

    if (movedGroupBlocks.get('length')) {
      this.get('canvas.blocks').replace(groupIndex + 2, 0, [newGroup]);
      this.get('onNewBlockInsertedLocally')(groupIndex + 2, newGroup);
    }

    this.removeGroupIfEmpty(group);
    run.scheduleOnce('afterRender', this, 'focusBlockStart', block);
  },

  actions: {
    /**
     * Called when block content was updated locally.
     *
     * @method
     * @param {CanvasEditor.CanvasRealtime.Block} block The block whose content
     *   was updated locally
     */
    blockContentUpdatedLocally(block) {
      this.get('onBlockContentUpdatedLocally')(block);
    },

    /**
     * Called when block meta was updated locally.
     *
     * @method
     * @param {CanvasEditor.CanvasRealtime.Block} block The block whose meta
     *   was updated locally
     * @param {Array<*>} metaPath The path to the updated meta property
     * @param {*} oldValue The old meta value
     * @param {*} newValue The new meta value
     */
    blockMetaReplacedLocally(block, metaPath, oldValue, newValue) {
      this.get('onBlockMetaReplacedLocally')(
        block, metaPath, oldValue, newValue);
    },

    /**
     * Called when block type was updated locally.
     *
     * @method
     * @param {CanvasEditor.CanvasRealtime.Block} block The block whose type was
     *   updated locally
     */
    blockTypeUpdatedLocally(block) {
      this.get('onBlockTypeUpdatedLocally')(block);
    },

    /* eslint-disable max-statements */
    /**
     * Called when the user deletes a block.
     *
     * If there is still text remaining, we join it with the previous block,
     * if possible.
     *
     * @method
     * @param {CanvasEditor.CanvasRealtime.Block} block The block that the user
     *   deleted in
     * @param {string} remainingContent The remaining content left in the block
     * @param {object} opts Options for deleting the block
     * @param {boolean} opts.onlySelf Only remove the given block
     */
    blockDeletedLocally(block, remainingContent = '', opts = {}) {
      if (opts.onlySelf) {
        const index = this.get('canvas.blocks').indexOf(block);
        this.get('canvas.blocks').removeObject(block);
        this.get('onBlockDeletedLocally')(index, block);
        return;
      }

      const navigableBlocks = this.getNavigableBlocks();
      const navigableIndex = navigableBlocks.indexOf(block);
      const prevBlock = navigableBlocks.objectAt(navigableIndex - 1);

      if (!prevBlock) return; // `block` is the first block

      if (prevBlock.get('isCard')) {
        const index = this.get('canvas.blocks').indexOf(prevBlock);
        this.get('canvas.blocks').removeObject(prevBlock);
        this.get('onBlockDeletedLocally')(index, prevBlock);
        return;
      }

      /*
       * Capture selection at the end of the previous block, so we can restore
       * to that position once we've joined the deleted block's remaining
       * content onto it.
       */
      const $prevBlock = this.$(`[data-block-id="${prevBlock.get('id')}"]`);
      const selectionState = new SelectionState($prevBlock.get(0));
      this.focusBlockEnd(prevBlock);
      selectionState.capture();

      prevBlock.set('lastContent', prevBlock.get('content'));
      prevBlock.set('content', prevBlock.get('content') + remainingContent);

      // It's not clear why we do this (cc @olivia)
      if (block.get('parent.blocks.length') === 0) {
        block = block.get('parent');
      }

      if (block.get('parent')) {
        const index = block.get('parent.blocks').indexOf(block);
        block.get('parent.blocks').removeObject(block);
        this.get('onBlockDeletedLocally')(index, block);
        this.removeGroupIfEmpty(block.get('parent'));
      } else {
        const index = this.get('canvas.blocks').indexOf(block);
        this.get('canvas.blocks').removeObject(block);
        this.get('onBlockDeletedLocally')(index, block);
      }

      this.get('onBlockContentUpdatedLocally')(prevBlock);
      run.scheduleOnce('afterRender', selectionState, 'restore');
    },
    /* eslint-enable max-statements */

    /* eslint-disable max-statements */
    changeBlockType(typeChange, block, content) {
      const blocks = this.get('canvas.blocks');

      switch (typeChange) {
        case 'paragraph/unordered-list-item': {
          const index = blocks.indexOf(block);

          this.get('onBlockDeletedLocally')(index, block);

          const group = List.create({ blocks: Ember.A([block]) });

          block.setProperties({
            type: 'unordered-list-item',
            content: content.slice(2)
          });

          blocks.replace(index, 1, [group]);
          this.get('onNewBlockInsertedLocally')(index, group);
          run.scheduleOnce('afterRender', this, 'focusBlockStart', block);
          break;
        } case 'checklist-item/paragraph':
          case 'unordered-list-item/paragraph': {
          this.splitGroupAtMember(block, content);
          break;
        } case 'checklist-item/unordered-list-item': {
          const group = block.get('parent');
          const index = group.get('blocks').indexOf(block);
          const newBlock =
            UnorderedListItem.createFromMarkdown(content, {
              id: block.get('id'),
              parent: group
            });
          this.get('onBlockDeletedLocally')(index, block);
          this.get('onNewBlockInsertedLocally')(index, newBlock);
          group.get('blocks').replace(index, 1, [newBlock]);
          run.scheduleOnce('afterRender', this, 'focusBlockStart', block);
          break;
        } case 'unordered-list-item/checklist-item': {
          const group = block.get('parent');
          const index = group.get('blocks').indexOf(block);
          const newBlock =
            ChecklistItem.createFromMarkdown(content, {
              id: block.get('id'),
              parent: group
            });
          this.get('onBlockDeletedLocally')(index, block);
          this.get('onNewBlockInsertedLocally')(index, newBlock);
          group.get('blocks').replace(index, 1, [newBlock]);
          run.scheduleOnce('afterRender', this, 'focusBlockStart', block);
          break;
        } default: {
          throw new Error(`Cannot do type change: "${typeChange}"`);
        }
      }
    },
    /* eslint-enable max-statements */

    /**
     * Called when the user replaces a block, such as converting a paragraph
     * to a URL card.
     *
     * @method
     * @param {CanvasEditor.CanvasRealtime.Block} block The block that the user
     *   replaced
     * @param {CanvasEditor.CanvasRealtime.Block} newBlock The block that the
     *   user replaced with
     */
    blockReplacedLocally(block, newBlock) {
      const index = this.get('canvas.blocks').indexOf(block);
      this.get('canvas.blocks').replace(index, 1, newBlock);
      this.get('onBlockReplacedLocally')(index, block, newBlock);
    },

    /**
     * Called when the user wishes to navigate down to the next block from the
     * currently focused block.
     *
     * @method
     * @param {CanvasEditor.CanvasRealtime.Block} block The block that the user
     *   wishes to navigate down *from*
     * @param {ClientRect} rangeRect The client rect for the current user range
     */
    navigateDown(block, rangeRect) {
      const blocks = this.getNavigableBlocks();
      const blockIndex = blocks.indexOf(block);
      const nextBlock = blocks.objectAt(blockIndex + 1);
      if (!nextBlock) return; // `block` is the last block

      if (nextBlock.get('isCard')) {
        Selection.selectCardBlock(this.$(), nextBlock);
      } else {
        Selection.navigateDownToBlock(this.$(), nextBlock, rangeRect);
      }
    },

    /**
     * Called when the user wishes to navigate to the end of the block before
     * the currently focused block.
     *
     * @method
     * @param {CanvasEditor.CanvasRealtime.Block} block The block that the user
     *   wishes to navigate *from*
     */
    navigateLeft(block) {
      const blocks = this.getNavigableBlocks();
      const blockIndex = blocks.indexOf(block);
      const prevBlock = blocks.objectAt(blockIndex - 1);
      if (!prevBlock) return; // `block` is the first block

      if (prevBlock.get('isCard')) {
        Selection.selectCardBlock(this.$(), prevBlock);
      } else {
        run.scheduleOnce('afterRender', this, 'focusBlockEnd', prevBlock);
      }
    },

    /**
     * Called when the user wishes to navigate to the start of the block after
     * the currently focused block.
     *
     * @method
     * @param {CanvasEditor.CanvasRealtime.Block} block The block that the user
     *   wishes to navigate *from*
     */
    navigateRight(block) {
      const blocks = this.getNavigableBlocks();
      const blockIndex = blocks.indexOf(block);
      const nextBlock = blocks.objectAt(blockIndex + 1);
      if (!nextBlock) return; // `block` is the last block

      if (nextBlock.get('isCard')) {
        Selection.selectCardBlock(this.$(), nextBlock);
      } else {
        run.scheduleOnce('afterRender', this, 'focusBlockStart', nextBlock);
      }
    },

    /**
     * Called when the user wishes to navigate up to the previous block from the
     * currently focused block.
     *
     * @method
     * @param {CanvasEditor.CanvasRealtime.Block} block The block that the user
     *   wishes to navigate up *from*
     * @param {ClientRect} rangeRect The client rect for the current user range
     */
    navigateUp(block, rangeRect) {
      const blocks = this.getNavigableBlocks();
      const blockIndex = blocks.indexOf(block);
      const prevBlock = blocks.objectAt(blockIndex - 1);
      if (!prevBlock) return; // `block` is the first block

      if (prevBlock.get('isCard')) {
        Selection.selectCardBlock(this.$(), prevBlock);
      } else {
        Selection.navigateUpToBlock(this.$(), prevBlock, rangeRect);
      }
    },

    /**
     * Called when a new block was added after `prevBlock` and the canvas model
     * needs to be updated.
     *
     * @method
     * @param {CanvasEditor.CanvasRealtime.Block} prevBlock The block that the
     *   new block should be inserted after
     * @param {CanvasEditor.CanvasRealtime.Block} newBlock The new block
     */
    newBlockInsertedLocally(prevBlock, newBlock) {
      const parent =
        prevBlock.get('parent.blocks') || this.get('canvas.blocks');
      const index = parent.indexOf(prevBlock) + 1;
      parent.replace(index, 0, [newBlock]);
      this.get('onNewBlockInsertedLocally')(index, newBlock);
      run.scheduleOnce('afterRender', this, 'focusBlockStart', newBlock);
    },

    /**
     * Called when a card block is rendered to unfurl it.
     *
     * @method
     * @param {CanvasEditor.CanvasRealtime.Block} block The block to unfurl
     */
    unfurl(block) {
      return this.get('unfurlBlock')(block);
    }
  }
});
