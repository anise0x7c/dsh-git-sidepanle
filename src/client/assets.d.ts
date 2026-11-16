/**
 * The browser bundle imports its stylesheet as text; esbuild's `text` loader
 * supplies it, and this declaration gives TypeScript the same shape.
 */
declare module '*.css' {
  const content: string
  export default content
}
