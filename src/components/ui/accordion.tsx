import * as React from "react";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const Accordion = AccordionPrimitive.Root;

const AccordionItem = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className, ...props }, ref) => (
  <AccordionPrimitive.Item ref={ref} className={cn("border-b", className)} {...props} />
));
AccordionItem.displayName = "AccordionItem";

const AccordionTrigger = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Header className="flex">
    <AccordionPrimitive.Trigger
      ref={ref}
      className={cn(
        /*
          FIX: `hover:underline` → `hover:text-foreground`.
          `hover:underline` es la convención universal para enlaces (<a>).
          Aplicarlo a un botón de disclosure envía la señal incorrecta al
          usuario: "esto es un enlace" cuando en realidad es un toggle de
          contenido. Reemplazado con `hover:text-foreground` que indica
          interactividad sin implicar navegación.

          FIX: `transition-all` → `transition-colors`.
          `transition-all` hace que el navegador monitorice TODAS las
          propiedades CSS animables en cada frame (incluyendo `box-shadow`,
          `filter`, `transform`, etc.), lo que genera trabajo de compositing
          innecesario. Solo necesitamos transición de color.

          FIX: `motion-reduce:transition-none` añadido.
          La transición ignoraba `prefers-reduced-motion`. Los usuarios con
          esta preferencia activa (epilepsia fotosensible, mareo por movimiento)
          verán el cambio de color sin transición.
        */
        "flex flex-1 items-center justify-between py-4 font-medium transition-colors hover:text-foreground motion-reduce:transition-none [&[data-state=open]>svg]:rotate-180",
        className,
      )}
      {...props}
    >
      {children}
      {/*
        FIX: `aria-hidden="true"` en el ChevronDown.
        El ícono es puramente decorativo — Radix UI ya comunica el estado
        expandido/colapsado mediante `aria-expanded` en el trigger y la
        región controlada con `aria-controls`. Sin `aria-hidden`, lectores
        de pantalla como NVDA leen "chevron abajo" o "chevron arriba" además
        del texto del trigger, resultando en anuncios redundantes.

        FIX: `motion-reduce:transition-none` en el ChevronDown.
        La rotación del chevron también ignoraba `prefers-reduced-motion`.
      */}
      <ChevronDown
        className="h-4 w-4 shrink-0 transition-transform duration-200 motion-reduce:transition-none"
        aria-hidden="true"
      />
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>
));
AccordionTrigger.displayName = AccordionPrimitive.Trigger.displayName;

const AccordionContent = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Content
    ref={ref}
    className={cn(
      /*
        FIX: `transition-all` → sin `transition-all` (las animaciones de
        acordeón están controladas por `@keyframes` definidos en tailwind.config,
        no por `transition`). Eliminada la clase `transition-all` del Content
        que era redundante con las clases `animate-accordion-*` y creaba
        compositing innecesario.

        FIX: `motion-reduce:animate-none` añadido a ambas animaciones.
        Las clases `animate-accordion-down` y `animate-accordion-up` usan
        `@keyframes` que ignoran `prefers-reduced-motion`. Con
        `motion-reduce:animate-none`, el contenido aparece/desaparece
        instantáneamente cuando el usuario prefiere movimiento reducido.
        Radix UI maneja la visibilidad del contenido correctamente en
        ambos casos mediante el atributo `data-state`.
      */
      /*
        FIX: `motion-safe:` en lugar de `motion-reduce:animate-none`.
        Con `motion-safe:data-[state=*]:animate-*` las animaciones SOLO
        se aplican cuando el usuario NO tiene `prefers-reduced-motion: reduce`.
        Esto evita el problema de especificidad de intentar sobreescribir
        selectores `data-[state]` con `motion-reduce:animate-none` (los
        selectores de atributo tienen mayor especificidad que clases simples).
        En modo reducido, Radix controla la visibilidad del contenido via
        `data-state` y el atributo `hidden` sin necesidad de animación.
      */
      "overflow-hidden text-sm motion-safe:data-[state=closed]:animate-accordion-up motion-safe:data-[state=open]:animate-accordion-down",
    )}
    {...props}
  >
    <div className={cn("pb-4 pt-0", className)}>{children}</div>
  </AccordionPrimitive.Content>
));
AccordionContent.displayName = AccordionPrimitive.Content.displayName;

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
