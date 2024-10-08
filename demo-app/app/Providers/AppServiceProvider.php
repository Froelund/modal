<?php

namespace App\Providers;

use App\InertiaUIModal;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\ServiceProvider;
use Inertia\Response;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        Response::macro('modal', function ($baseUrl) {
            if (request()->header('X-InertiaUI-Modal')) {
                return $this;
            }

            return new InertiaUIModal([
                'baseUrl' => $baseUrl,
                'component' => $this->component,
                'props' => $this->props,
                'version' => $this->version,
            ]);
        });
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Model::unguard();
    }
}
