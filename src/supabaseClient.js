import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://ihjbrdkrlrmponnlmuqs.supabase.co";
const supabaseAnonKey = "sb_publishable_05tIP8epsmLaPHybTL9_jg_HLcLLDze";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);