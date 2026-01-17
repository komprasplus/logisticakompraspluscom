-- Delete orphaned user_roles entries (motorizados without profiles)
DELETE FROM public.user_roles 
WHERE user_id NOT IN (SELECT user_id FROM public.profiles);