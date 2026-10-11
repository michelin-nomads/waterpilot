import { ModalFrame, type ModalProps } from '../Modal/ModalFrame';

/** Side sheet anchored to the right edge (e.g. the funding-source drawer). */
export function Drawer(props: ModalProps) {
  return <ModalFrame variant="drawer" {...props} />;
}
