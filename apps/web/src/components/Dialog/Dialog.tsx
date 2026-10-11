import { ModalFrame, type ModalProps } from '../Modal/ModalFrame';

export interface DialogProps extends ModalProps {
  size?: 'sm' | 'md' | 'lg';
}

/** Centred modal dialog (e.g. Water Source Details, Generate Proposal). */
export function Dialog(props: DialogProps) {
  return <ModalFrame variant="dialog" {...props} />;
}
