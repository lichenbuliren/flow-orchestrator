import { useMemo } from 'react';
import type { ObjectType } from '../interfaces';

/**
 * Shape of the propsData that StateFlowV3 passes to each page node.
 */
interface FlowPropsData<TData = unknown, TMeta = ObjectType> {
  flowMeta?: TMeta;
  flowNode?: {
    id: string | number;
    name: string;
    data?: TData;
  };
  __isGoBack?: boolean;
  [key: string]: unknown;
}

/**
 * Generic page props interface.
 * If your framework provides its own (e.g., FunctionalPageProps), use that instead
 * and just pass `props.propsData` or the full props to this hook.
 */
interface PageProps {
  propsData?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface UseFlowNodeReturn<TData = unknown, TMeta = ObjectType> {
  /** Flow-level metadata */
  meta: TMeta | undefined;
  /** Current node info */
  node: { id: string | number; name: string; data?: TData } | undefined;
  /** Shortcut to node.data */
  data: TData | undefined;
  /** Whether this page was re-created via goBack (page state may need restoring) */
  isGoBack: boolean;
}

/**
 * React hook to extract flow node data from page props.
 *
 * @example
 * ```tsx
 * const MyPage: React.FC<FunctionalPageProps> = (props) => {
 *   const { data, meta, isGoBack } = useFlowNode<MyNodeData, MyMeta>(props);
 *
 *   useEffect(() => {
 *     if (isGoBack) restoreCachedFormData();
 *   }, [isGoBack]);
 *
 *   return <Form data={data} />;
 * };
 * ```
 */
export function useFlowNode<TData = unknown, TMeta = ObjectType>(
  props: PageProps
): UseFlowNodeReturn<TData, TMeta> {
  const propsData = props.propsData as FlowPropsData<TData, TMeta> | undefined;

  return useMemo(() => {
    const flowMeta = propsData?.flowMeta as TMeta | undefined;
    const flowNode = propsData?.flowNode as
      | { id: string | number; name: string; data?: TData }
      | undefined;

    return {
      meta: flowMeta,
      node: flowNode,
      data: flowNode?.data,
      isGoBack: Boolean(propsData?.__isGoBack),
    };
  }, [propsData]);
}
