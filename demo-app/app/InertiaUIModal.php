<?php

namespace App;

use Illuminate\Contracts\Support\Responsable;
use Illuminate\Http\Request;
use Illuminate\Routing\Middleware\SubstituteBindings;
use Illuminate\Support\Facades\Route;

class InertiaUIModal implements Responsable
{
    public function __construct(protected array $modalData)
    {
        //
    }

    /**
     * {@inheritdoc}
     *
     * @see https://github.com/lepikhinb/momentum-modal/blob/b45992e4982859990a076dd924e19e589ff9797e/src/Modal.php
     */
    public function toResponse($originalRequest)
    {
        inertia()->share('_inertiaui_modal', $this->modalData);

        $requestForBaseUrl = Request::create(
            $this->modalData['baseUrl'],
            Request::METHOD_GET,
            $originalRequest->query->all(),
            $originalRequest->cookies->all(),
            $originalRequest->files->all(),
            $originalRequest->server->all(),
            $originalRequest->getContent()
        );

        $requestForBaseUrl->headers->replace($originalRequest->headers->all());
        $requestForBaseUrl->setRequestLocale($originalRequest->getLocale());
        $requestForBaseUrl->setDefaultRequestLocale($originalRequest->getDefaultLocale());

        if ($originalRequest->hasSession() && $session = $originalRequest->session()) {
            $requestForBaseUrl->setLaravelSession($session);
        }

        $baseRoute = Route::getRoutes()->match($requestForBaseUrl);

        $requestForBaseUrl
            ->setJson($originalRequest->json())
            ->setUserResolver(fn () => $originalRequest->getUserResolver())
            ->setRouteResolver(fn () => $baseRoute);

        app()->instance('request', $requestForBaseUrl);

        return (new SubstituteBindings(Route::getFacadeRoot()))->handle(
            $requestForBaseUrl, fn () => $baseRoute->run()
        )->toResponse($originalRequest);
    }
}
