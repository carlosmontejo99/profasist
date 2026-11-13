package com.carlos.profasist;

import android.Manifest;
import android.content.ContentValues;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import android.widget.Toast;
import android.util.Base64;
import com.getcapacitor.BridgeActivity;
import java.io.OutputStream;

import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import java.util.concurrent.Executor;

public class MainActivity extends BridgeActivity {
    private boolean configured = false;

    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        // Only the dedicated "agent" build type exposes the WebView DevTools
        // socket. The normal release build keeps WebView debugging disabled.
        if (BuildConfig.AGENT_BRIDGE) {
            WebView.setWebContentsDebuggingEnabled(true);
        }

        super.onCreate(savedInstanceState);
        if (BuildConfig.AGENT_BRIDGE) {
            // Capacitor sets debugging from isDebug during super.onCreate; the
            // agent build is a release-type build, so re-enable it afterwards.
            WebView.setWebContentsDebuggingEnabled(true);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, 100);
            }
        }
        
        // Register back button callback using AndroidX OnBackPressedDispatcher to support gestures on Android 13+
        getOnBackPressedDispatcher().addCallback(this, new androidx.activity.OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView wv = getBridge().getWebView();
                if (wv != null) {
                    wv.evaluateJavascript("document.dispatchEvent(new Event('backbutton'));", null);
                } else {
                    setEnabled(false);
                    getOnBackPressedDispatcher().onBackPressed();
                    setEnabled(true);
                }
            }
        });
    }

    @Override
    public void onResume() {
        super.onResume();
        if (BuildConfig.AGENT_BRIDGE) {
            WebView.setWebContentsDebuggingEnabled(true);
        }
        if (!configured) {
            configured = true;
            WebView wv = getBridge().getWebView();
            if (wv != null) {
                // Register Javascript interface for native file downloads and biometrics
                wv.addJavascriptInterface(new Object() {
                    @JavascriptInterface
                    public void saveFile(String base64Data, String fileName, String mimeType) {
                        try {
                            byte[] fileBytes = Base64.decode(base64Data, Base64.DEFAULT);
                            
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                                ContentValues values = new ContentValues();
                                values.put(MediaStore.Downloads.DISPLAY_NAME, fileName);
                                values.put(MediaStore.Downloads.MIME_TYPE, mimeType);
                                values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                                
                                Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                                if (uri != null) {
                                    try (OutputStream outputStream = getContentResolver().openOutputStream(uri)) {
                                        outputStream.write(fileBytes);
                                        runOnUiThread(() -> Toast.makeText(MainActivity.this, "Guardado en Descargas: " + fileName, Toast.LENGTH_LONG).show());
                                    }
                                }
                            } else {
                                java.io.File downloadDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                                java.io.File file = new java.io.File(downloadDir, fileName);
                                try (java.io.FileOutputStream fos = new java.io.FileOutputStream(file)) {
                                    fos.write(fileBytes);
                                    runOnUiThread(() -> Toast.makeText(MainActivity.this, "Guardado en Descargas: " + fileName, Toast.LENGTH_LONG).show());
                                }
                            }
                        } catch (Exception e) {
                            e.printStackTrace();
                            runOnUiThread(() -> Toast.makeText(MainActivity.this, "Error al guardar: " + e.getMessage(), Toast.LENGTH_LONG).show());
                        }
                    }

                    @JavascriptInterface
                    public void exitApp() {
                        finish();
                    }

                    @JavascriptInterface
                    public boolean isBiometricAvailable() {
                        try {
                            BiometricManager biometricManager = BiometricManager.from(MainActivity.this);
                            int canAuthenticate = biometricManager.canAuthenticate(
                                BiometricManager.Authenticators.BIOMETRIC_STRONG | 
                                BiometricManager.Authenticators.DEVICE_CREDENTIAL
                            );
                            return canAuthenticate == BiometricManager.BIOMETRIC_SUCCESS;
                        } catch (Exception e) {
                            return false;
                        }
                    }

                    @JavascriptInterface
                    public void authenticateBiometric() {
                        runOnUiThread(() -> {
                            try {
                                Executor executor = ContextCompat.getMainExecutor(MainActivity.this);
                                BiometricPrompt biometricPrompt = new BiometricPrompt(MainActivity.this, executor,
                                    new BiometricPrompt.AuthenticationCallback() {
                                        @Override
                                        public void onAuthenticationError(int errorCode, CharSequence errString) {
                                            super.onAuthenticationError(errorCode, errString);
                                            WebView webView = getBridge().getWebView();
                                            if (webView != null) {
                                                String js = "window.dispatchEvent(new CustomEvent('biometric-result', { detail: { success: false, error: '" + errString.toString().replace("'", "\\'") + "' } }));";
                                                webView.evaluateJavascript(js, null);
                                            }
                                        }

                                        @Override
                                        public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                                            super.onAuthenticationSucceeded(result);
                                            WebView webView = getBridge().getWebView();
                                            if (webView != null) {
                                                String js = "window.dispatchEvent(new CustomEvent('biometric-result', { detail: { success: true } }));";
                                                webView.evaluateJavascript(js, null);
                                            }
                                        }

                                        @Override
                                        public void onAuthenticationFailed() {
                                            super.onAuthenticationFailed();
                                            WebView webView = getBridge().getWebView();
                                            if (webView != null) {
                                                String js = "window.dispatchEvent(new CustomEvent('biometric-result', { detail: { success: false, error: 'Autenticación fallida' } }));";
                                                webView.evaluateJavascript(js, null);
                                            }
                                        }
                                    });

                                BiometricPrompt.PromptInfo promptInfo = new BiometricPrompt.PromptInfo.Builder()
                                    .setTitle("Autenticación Requerida")
                                    .setSubtitle("Usa tu huella dactilar, rostro o PIN del dispositivo")
                                    .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG | BiometricManager.Authenticators.DEVICE_CREDENTIAL)
                                    .build();

                                biometricPrompt.authenticate(promptInfo);
                            } catch (Exception e) {
                                e.printStackTrace();
                                WebView webView = getBridge().getWebView();
                                if (webView != null) {
                                    webView.evaluateJavascript("window.dispatchEvent(new CustomEvent('biometric-result', { detail: { success: false, error: '" + e.getMessage() + "' } }));", null);
                                }
                            }
                        });
                    }
                }, "Android");

                if (wv.getWebChromeClient() != null) {
                    WebChromeClient orig = wv.getWebChromeClient();
                    wv.setWebChromeClient(new WebChromeClient() {
                        @Override
                        public void onPermissionRequest(PermissionRequest request) {
                            for (String r : request.getResources()) {
                                if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(r)) {
                                    request.grant(new String[]{r});
                                    return;
                                }
                            }
                            if (orig != null) orig.onPermissionRequest(request);
                            else request.deny();
                        }

                        @Override
                        public boolean onShowFileChooser(WebView webView, android.webkit.ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
                            if (orig != null) {
                                return orig.onShowFileChooser(webView, filePathCallback, fileChooserParams);
                            }
                            return super.onShowFileChooser(webView, filePathCallback, fileChooserParams);
                        }

                        @Override
                        public boolean onJsAlert(WebView view, String url, String message, android.webkit.JsResult result) {
                            if (orig != null) return orig.onJsAlert(view, url, message, result);
                            return super.onJsAlert(view, url, message, result);
                        }

                        @Override
                        public boolean onJsConfirm(WebView view, String url, String message, android.webkit.JsResult result) {
                            if (orig != null) return orig.onJsConfirm(view, url, message, result);
                            return super.onJsConfirm(view, url, message, result);
                        }

                        @Override
                        public boolean onJsPrompt(WebView view, String url, String message, String defaultValue, android.webkit.JsPromptResult result) {
                            if (orig != null) return orig.onJsPrompt(view, url, message, defaultValue, result);
                            return super.onJsPrompt(view, url, message, defaultValue, result);
                        }
                    });
                }
            }
        }
    }

}
