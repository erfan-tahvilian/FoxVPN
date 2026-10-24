// SPDX-License-Identifier: GPL-3.0-or-later
package com.foxvpn.android;

import android.app.AlertDialog;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ResolveInfo;
import android.graphics.Color;
import android.view.View;
import android.view.ViewGroup;
import android.widget.*;
import java.util.*;
import java.util.function.Consumer;
import org.json.JSONArray;

/** App selection shares the saved package list with the manual editor. */
final class AppPicker {
    private record App(String name,String packageName,ResolveInfo info) {}
    private final Context context;
    private final List<App> apps=new ArrayList<>(),filtered=new ArrayList<>();
    private final Set<String> selected=new LinkedHashSet<>();
    private final Consumer<List<String>> changed;
    private final boolean onlySelected;
    private final String ownPackage;
    private final BaseAdapter adapter=new BaseAdapter(){
        @Override public int getCount(){return filtered.size();}
        @Override public Object getItem(int index){return filtered.get(index);}
        @Override public long getItemId(int index){return index;}
        @Override public View getView(int index,View recycled,ViewGroup parent){
            App app=filtered.get(index);
            LinearLayout row=new LinearLayout(context);row.setGravity(android.view.Gravity.CENTER_VERTICAL);row.setPadding(dp(16),dp(8),dp(16),dp(8));row.setMinimumHeight(dp(64));
            ImageView icon=new ImageView(context);try{icon.setImageDrawable(context.getPackageManager().getApplicationIcon(app.packageName));}catch(android.content.pm.PackageManager.NameNotFoundException error){icon.setImageResource(android.R.drawable.sym_def_app_icon);}icon.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
            row.addView(icon,new LinearLayout.LayoutParams(dp(36),dp(36)));
            LinearLayout text=new LinearLayout(context);text.setOrientation(LinearLayout.VERTICAL);text.setPadding(dp(12),0,dp(8),0);
            TextView title=new TextView(context);title.setText(app.name);title.setTextSize(15);text.addView(title);
            TextView packageName=new TextView(context);packageName.setText(app.packageName);packageName.setTextSize(11);packageName.setAlpha(.6f);text.addView(packageName);
            row.addView(text,new LinearLayout.LayoutParams(0,-2,1));
            CheckBox check=new CheckBox(context);check.setChecked(selected.contains(app.packageName));check.setButtonTintList(android.content.res.ColorStateList.valueOf(Color.rgb(255,117,24)));check.setClickable(false);check.setFocusable(false);check.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);row.addView(check);
            row.setContentDescription(app.name+(check.isChecked()==onlySelected?", uses VPN":", uses regular connection"));
            row.setOnClickListener(view->{if(!selected.remove(app.packageName))selected.add(app.packageName);notifyDataSetChanged();changed.accept(new ArrayList<>(selected));});
            return row;
        }
    };
    AppPicker(Context context,String ownPackage,JSONArray saved,boolean onlySelected,Consumer<List<String>> changed){
        this.context=context;this.changed=changed;this.onlySelected=onlySelected;this.ownPackage=ownPackage;
        if(saved!=null)for(int i=0;i<saved.length();i++)selected.add(saved.optString(i));
    }
    private List<App> loadApps(){
        List<App> result=new ArrayList<>();
        Set<String> seen=new HashSet<>();
        for(ResolveInfo info:context.getPackageManager().queryIntentActivities(new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER),0)){
            String name=info.activityInfo.packageName;
            if(!name.equals(ownPackage)&&seen.add(name))result.add(new App(info.loadLabel(context.getPackageManager()).toString(),name,info));
        }
        for(String name:selected)if(!seen.contains(name)&&!name.equals(ownPackage))result.add(new App(name,name,null));
        result.sort(Comparator.comparing((App app)->!selected.contains(app.packageName)).thenComparing(App::name,String.CASE_INSENSITIVE_ORDER));return result;
    }
    private int dp(int value){return Math.round(value*context.getResources().getDisplayMetrics().density);}
    void show(){
        LinearLayout content=new LinearLayout(context);content.setOrientation(LinearLayout.VERTICAL);
        EditText search=new EditText(context);search.setSingleLine(true);search.setHint("Search apps");search.setInputType(android.text.InputType.TYPE_CLASS_TEXT);search.setPadding(dp(20),dp(12),dp(20),dp(12));search.setEnabled(false);content.addView(search);
        ProgressBar progress=new ProgressBar(context);content.addView(progress,new LinearLayout.LayoutParams(dp(32),dp(32)));
        ListView list=new ListView(context);list.setDivider(null);list.setVerticalScrollBarEnabled(false);list.setAdapter(adapter);content.addView(list,new LinearLayout.LayoutParams(-1,dp(360)));
        TextView empty=new TextView(context);empty.setText("Loading apps…");empty.setPadding(dp(20),dp(20),dp(20),dp(20));content.addView(empty);list.setEmptyView(empty);
        search.addTextChangedListener(new android.text.TextWatcher(){
            public void beforeTextChanged(CharSequence s,int start,int count,int after){}
            public void onTextChanged(CharSequence s,int start,int before,int count){String query=s.toString().trim().toLowerCase(Locale.ROOT);filtered.clear();for(App app:apps)if(app.name.toLowerCase(Locale.ROOT).contains(query)||app.packageName.toLowerCase(Locale.ROOT).contains(query))filtered.add(app);adapter.notifyDataSetChanged();}
            public void afterTextChanged(android.text.Editable s){}
        });
        AlertDialog dialog=new AlertDialog.Builder(context).setTitle(onlySelected?"Apps using VPN":"Exclude apps").setView(content).setPositiveButton("Done",null).create();
        dialog.setOnShowListener(ignored->{dialog.getWindow().setSoftInputMode(android.view.WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_HIDDEN|android.view.WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);dialog.getButton(AlertDialog.BUTTON_POSITIVE).setTextColor(Color.rgb(255,117,24));});
        dialog.show();
        new Thread(()->{
            try{
                List<App> loaded=loadApps();
                new android.os.Handler(android.os.Looper.getMainLooper()).post(()->{
                    if(!dialog.isShowing())return;
                    apps.addAll(loaded);filtered.addAll(loaded);empty.setText("No apps found");progress.setVisibility(View.GONE);search.setEnabled(true);adapter.notifyDataSetChanged();
                });
            }catch(RuntimeException error){
                new android.os.Handler(android.os.Looper.getMainLooper()).post(()->{if(dialog.isShowing()){progress.setVisibility(View.GONE);empty.setText("Apps could not be loaded. Close this window and try again.");}});
            }
        },"FoxVPN-app-catalog").start();
    }
}
