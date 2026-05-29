-- Allow users to delete their own cancelled or refunded orders (and cascade to order_items)
CREATE POLICY "users delete own cancelled orders"
ON public.orders
FOR DELETE
TO authenticated
USING (auth.uid() = user_id AND status IN ('cancelled', 'refunded'));

CREATE POLICY "users delete own order items for cancelled orders"
ON public.order_items
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id
      AND o.user_id = auth.uid()
      AND o.status IN ('cancelled', 'refunded')
  )
);