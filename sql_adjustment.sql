UPDATE public.colaboradores
SET shift = shift_types.label
FROM public.shift_types
WHERE colaboradores.shift = shift_types.code;
