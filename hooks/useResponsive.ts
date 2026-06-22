
import { useWindowDimensions } from 'react-native';

const DESKTOP_BREAKPOINT = 980;

export function useResponsive(breakpoint = DESKTOP_BREAKPOINT) {
  const { width, height } = useWindowDimensions();
  const isDesktop = width >= breakpoint;
  
  return {
    width,
    height,
    isDesktop,
  };
}