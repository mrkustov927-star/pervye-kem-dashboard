(()=>{
  const endpoints=[
    'https://geiuieajngqmyrrlicwj.supabase.co/functions/v1/kpo-gateway',
    'https://geiuieajngqmyrrlicwj.functions.supabase.co/kpo-gateway'
  ];
  let active=0;
  async function requestAt(index,path,options={},timeout=15000){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),timeout);
    try{
      const response=await fetch(endpoints[index]+path,{...options,credentials:'omit',cache:'no-store',redirect:'error',signal:controller.signal});
      const type=response.headers.get('Content-Type')||'';
      if(response.ok && !path.includes('file=') && !path.includes('handout=') && !type.includes('application/json'))throw Error('Некорректный ответ сети');
      const bytes=await response.arrayBuffer();
      return new Response(bytes,{status:response.status,headers:response.headers});
    }finally{clearTimeout(timer);}
  }
  window.kpoConnection={
    async request(path,options={}){
      const index=active;
      const retryable=!options.method || options.method==='GET' || path==='/planner?login=1';
      const timeout=path.includes('file=')?60000:20000;
      try{
        const first=await requestAt(index,path,options,timeout);
        if(!retryable || ![502,503,504].includes(first.status))return first;
      }catch(error){if(!retryable)throw error;}
      const second=await requestAt(1-index,path,options,timeout);
      if(second.status<500)active=1-index;
      return second;
    },
    async check(index){
      const response=await requestAt(index,'/planner',{headers:{Authorization:'Bearer connection-check'}},12000);
      return response.status===401 && typeof (await response.json()).error==='string';
    }
  };
})();
