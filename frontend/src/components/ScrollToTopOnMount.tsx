'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Ensures browser scroll position resets cleanly to the top of the viewport
 * whenever navigating to a dedicated tool page, preventing sticky navbar clipping.
 */
export const ScrollToTopOnMount: React.FC = () => {
  const pathname = usePathname();

  useEffect(() => {
    try {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    } catch {
      window.scrollTo(0, 0);
    }
  }, [pathname]);

  return null;
};
