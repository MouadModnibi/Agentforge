"use client";
import {useQuery} from '@tanstack/react-query';
export function useAccount(){return useQuery({queryKey:['account'],queryFn:async()=>{const r=await fetch('/api/auth',{cache:'no-store'});if(!r.ok)throw new Error('Unable to load account');const j=await r.json();return j.data.user as {id:string;name:string;email:string}|null;},staleTime:30000,retry:false});}
