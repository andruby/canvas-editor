import CanvasBlock from 'canvas-editor/components/canvas-block/component';
import ContentFilterable from 'canvas-editor/mixins/content-filterable';
import layout from './template';
import styles from './styles';

/*
 * A component representing a "paragraph" type canvas block.
 *
 * @class CanvasEditor.CanvasBlockParagraphComponent
 * @extends CanvasEditor.CanvasBlockComponent
 */
export default CanvasBlock.extend(ContentFilterable, {
  classNames: ['canvas-block-paragraph'],
  layout,
  localClassNames: ['canvas-block-paragraph'],
  styles
});
