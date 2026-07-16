import { cn } from './cn';

// Centered page width + consistent horizontal padding. `size` matches the
// max-widths already in use (the app standardized on max-w-5xl content;
// `prose` is the narrow reading width for forms and the chat).

export type ContainerSize = 'prose' | 'content' | 'wide';

const sizes: Record<ContainerSize, string> = {
  prose: 'max-w-2xl',
  content: 'max-w-5xl',
  wide: 'max-w-6xl',
};

export type ContainerProps = React.HTMLAttributes<HTMLDivElement> & {
  size?: ContainerSize;
};

export function Container({ size = 'content', className, ...props }: ContainerProps) {
  return <div className={cn('mx-auto w-full px-4 sm:px-6', sizes[size], className)} {...props} />;
}
