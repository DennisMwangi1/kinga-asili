interface DatabaseError {code?:string;message?:string;details?:string;}
/** Translate database failures without attributing unrelated unique keys to customers. */
export function operationError(action:string,error:DatabaseError){
 const constraint=(error.message||'').match(/unique constraint ["']([^"']+)["']/i)?.[1];
 if(error.code==='23505'){
  const known:Record<string,{message:string;field:string}>={
   products_blend_volume_ml_key:{message:'This blend and bottle size already exist. Edit the existing product instead.',field:'volume_ml'},
   customers_phone_key:{message:'A customer already uses this mobile number. Open that customer or use another number.',field:'phone'},
   batches_reference_key:{message:'This batch reference is already in use. Enter a different batch reference.',field:'reference'},
   purchases_reference_key:{message:'This purchase or expense reference is already in use. Enter a different reference.',field:'reference'},
   payments_reference_key:{message:'This payment reference has already been recorded. Check the existing payment before adding another.',field:'reference'},
   orders_reference_key:{message:'This order reference is already in use. Enter a different order reference.',field:'reference'},
   orders_idempotency_key_key:{message:'This order request has already been submitted. Check your orders before trying again.',field:'idempotency_key'},
   materials_name_key:{message:'A material with this name already exists. Open the existing material or use a different name.',field:'name'},
  };
  const fallback:Record<string,string>={save_customer:'customers_phone_key',update_customer:'customers_phone_key',save_batch:'batches_reference_key',save_purchase:'purchases_reference_key',record_payment:'payments_reference_key',save_material:'materials_name_key'};
  const match=known[constraint||fallback[action]];
  return {status:409,message:match?.message||'A record with these details already exists. Check the existing record before trying again.',...(match?{fieldErrors:{[match.field]:match.message}}:{})};
 }
 if(error.code==='42501')return {status:403,message:'Your staff role does not allow this action.'};
 if(error.code==='23503')return {status:409,message:'A linked record is no longer available. Refresh the workspace and select it again.'};
 if(error.code==='23514')return {status:422,message:'One or more values are outside the allowed range. Check quantities, amounts and dates.'};
 if(error.code==='22P02'||error.code==='22007'||error.code==='22008')return {status:422,message:'Check that numbers and dates are in the correct format.'};
 if(error.code==='23502')return {status:422,message:'Complete all required fields before saving.'};
 return {status:400,message:error.message||'The change could not be saved. Please try again.'};
}
export function workspaceError(error:unknown){
 if(error instanceof TypeError&&/fetch|network|load failed/i.test(error.message))return 'Could not connect to the workspace. Check your connection and try again.';
 return error instanceof Error?error.message:'The change could not be saved. Please try again.';
}
