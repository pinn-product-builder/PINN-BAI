declare module 'react-grid-layout' {
  import * as React from 'react';
  export interface Layout {
    i: string;
    x: number;
    y: number;
    w: number;
    h: number;
    minW?: number;
    minH?: number;
    static?: boolean;
  }
  export type Layouts = Record<string, Layout[]>;
  export interface ResponsiveProps {
    className?: string;
    layouts: Layouts;
    breakpoints: Record<string, number>;
    cols: Record<string, number>;
    rowHeight?: number;
    margin?: [number, number];
    containerPadding?: [number, number];
    isDraggable?: boolean;
    isResizable?: boolean;
    onLayoutChange?: (current: Layout[], all: Layouts) => void;
    draggableCancel?: string;
    compactType?: 'vertical' | 'horizontal' | null;
    children?: React.ReactNode;
  }
  export const Responsive: React.ComponentType<ResponsiveProps>;
  export function WidthProvider<P>(c: React.ComponentType<P>): React.ComponentType<P>;
  const RGL: React.ComponentType<any>;
  export default RGL;
}
