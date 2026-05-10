import { cn } from '@client/lib/utils';
import * as React from 'react';
import { DialogContent } from './dialog';

const BottomSheetContent = React.forwardRef<
  React.ElementRef<typeof DialogContent>,
  React.ComponentPropsWithoutRef<typeof DialogContent>
>(({ className, children, style, ...props }, ref) => {
  const [keyboardInset, setKeyboardInset] = React.useState(0);

  // iOS Safari leaves the layout viewport pinned to the screen edge when the
  // soft keyboard opens; without this the bottom sheet hides behind it. The
  // inset latches to its peak so dismissing the keyboard doesn't collapse the
  // sheet back down mid-interaction.
  React.useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKeyboardInset((prev) => Math.max(prev, Math.round(inset)));
    };
    update();
    vv.addEventListener('resize', update);
    return () => vv.removeEventListener('resize', update);
  }, []);

  return (
    <DialogContent
      ref={ref}
      style={{ ...style, '--kb-inset': `${keyboardInset}px` } as React.CSSProperties}
      className={cn(
        'sm:max-w-md max-sm:left-0 max-sm:top-auto max-sm:bottom-0 max-sm:translate-x-0 max-sm:translate-y-0 max-sm:max-w-full max-sm:rounded-t-2xl max-sm:rounded-b-none max-sm:p-4 max-sm:pb-[calc(env(safe-area-inset-bottom,0px)+1rem+var(--kb-inset,0px))] max-sm:data-[state=open]:zoom-in-100 max-sm:data-[state=closed]:zoom-out-100 max-sm:data-[state=open]:slide-in-from-bottom max-sm:data-[state=closed]:slide-out-to-bottom',
        className,
      )}
      {...props}
    >
      <div
        aria-hidden="true"
        className="mx-auto -mt-1 mb-1 h-1 w-10 rounded-full bg-muted-foreground/30 sm:hidden"
      />
      {children}
    </DialogContent>
  );
});
BottomSheetContent.displayName = 'BottomSheetContent';

export { BottomSheetContent };
