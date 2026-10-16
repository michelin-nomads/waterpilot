import { ModalFrame, type ModalProps } from '../Modal/ModalFrame';

interface DrawerProps extends ModalProps {
  size?: 'sm' | 'md' | 'lg';
}

/** Side sheet anchored to the right edge (e.g. the funding-source drawer). */
export function Drawer({ size = 'md', ...props }: DrawerProps) {
  return <ModalFrame variant="drawer" size={size} {...props} />;
}
