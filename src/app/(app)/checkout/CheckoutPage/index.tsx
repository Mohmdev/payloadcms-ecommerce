'use client'

import { LoadingShimmer } from '@/components/LoadingShimmer'
import { Media } from '@/components/Media'
import { Message } from '@/components/Message'
import { Price } from '@/components/Price'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/providers/Auth'
import { useCart } from '@/providers/Cart'
import { useTheme } from '@/providers/Theme'
import { Elements } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { Fragment, Suspense, useEffect, useRef, useState } from 'react'

import { cssVariables } from '@/cssVariables'
import { CheckoutForm } from '../CheckoutForm'

const apiKey = `${process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY}`
const stripe = loadStripe(apiKey)

export const CheckoutPage: React.FC = () => {
  const { user } = useAuth()
  const router = useRouter()
  const [error, setError] = useState<null | string>(null)
  const [clientSecret, setClientSecret] = useState()
  const hasMadePaymentIntent = useRef(false)
  const { theme } = useTheme()
  const [email, setEmail] = useState('')
  const [emailEditable, setEmailEditable] = useState(true)

  const { cart, cartIsEmpty, cartTotal } = useCart()

  useEffect(() => {
    if (
      cart &&
      (user || (Boolean(email) && !emailEditable)) &&
      hasMadePaymentIntent.current === false
    ) {
      hasMadePaymentIntent.current = true

      const makeIntent = async () => {
        try {
          const body = !user
            ? {
                cart,
                email
              }
            : undefined

          const paymentReq = await fetch(
            `${process.env.NEXT_PUBLIC_SERVER_URL}/api/create-payment-intent`,
            {
              ...(body
                ? {
                    body: JSON.stringify(body),
                    headers: {
                      'Content-Type': 'application/json'
                    }
                  }
                : {}),
              credentials: 'include',
              method: 'POST'
            }
          )

          const res = await paymentReq.json()

          if (res.error) {
            setError(res.error)
          } else if (res.client_secret) {
            setError(null)

            setClientSecret(res.client_secret)
          }
        } catch (e) {
          setError('Something went wrong.')
        }
      }

      void makeIntent()
    }
  }, [cart, user, emailEditable, email])

  if (!stripe) return null

  return (
    <div className="flex flex-col items-stretch justify-stretch gap-6 md:flex-row md:gap-12">
      <div className="flex w-full flex-grow flex-col gap-8">
        <div className="prose flex w-full flex-grow items-center rounded-sm bg-black p-4 dark:prose-invert">
          <Button
            asChild
            className="text-inherit no-underline"
            variant="outline"
          >
            <Link href="/login">Log in</Link>
          </Button>
          <p className="mt-0">
            <span className="mx-2">or</span>
            <Link href="/create-account">create an account</Link>
          </p>
        </div>
        {user ? (
          <div className="w-full rounded-sm bg-black p-4">
            <div>
              <p>{user.email}</p>{' '}
              <p>
                Not you? <Link href="/logout">Log out</Link>
              </p>
            </div>
          </div>
        ) : (
          <div className="w-full rounded-sm bg-black p-4">
            <div>
              <p className="mb-4">Enter your email to checkout as a guest.</p>
              <div className="mb-4 max-w-sm">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  disabled={!emailEditable}
                  id="email"
                  name="email"
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  type="email"
                />
              </div>
              <Button
                disabled={!email}
                onClick={() => {
                  setEmailEditable(false)
                }}
                variant="default"
              >
                Continue as guest
              </Button>
            </div>
          </div>
        )}

        {cartIsEmpty && (
          <div className="prose dark:prose-invert">
            <p>
              Your cart is empty.
              <Link href="/search">Continue shopping?</Link>
            </p>
          </div>
        )}
        {!clientSecret && !error && (
          <div className="my-8">
            <LoadingShimmer number={2} />
          </div>
        )}
        {!clientSecret && error && (
          <div className="my-8">
            <Message error={error} />

            <Button onClick={() => router.refresh()} variant="default">
              Try again
            </Button>
          </div>
        )}
        <Suspense fallback={<React.Fragment />}>
          {clientSecret && (
            <Fragment>
              {error && <p>{`Error: ${error}`}</p>}
              <Elements
                options={{
                  appearance: {
                    theme: 'stripe',
                    variables: {
                      borderRadius: '0px',
                      colorBackground:
                        theme === 'dark'
                          ? cssVariables.colors.base850
                          : cssVariables.colors.base0,
                      colorDanger: cssVariables.colors.error500,
                      colorDangerText: cssVariables.colors.error500,
                      colorIcon:
                        theme === 'dark'
                          ? cssVariables.colors.base0
                          : cssVariables.colors.base1000,
                      colorText:
                        theme === 'dark'
                          ? cssVariables.colors.base0
                          : cssVariables.colors.base1000,
                      colorTextPlaceholder: cssVariables.colors.base500,
                      fontFamily: 'Inter, sans-serif',
                      fontSizeBase: '16px',
                      fontWeightBold: '600',
                      fontWeightNormal: '500'
                    }
                  },
                  clientSecret
                }}
                stripe={stripe}
              >
                <CheckoutForm />
              </Elements>
            </Fragment>
          )}
        </Suspense>
      </div>
      {!cartIsEmpty && (
        <div className="w-full max-w-md">
          {cart?.items?.map((item, index) => {
            if (typeof item.product === 'object' && item.product) {
              const {
                product,
                product: { id, meta, title },
                quantity,
                variant: variantId
              } = item

              let stripeProductID

              if (variantId) {
                const variant = product.variants?.variants?.find(
                  (v) => v.id === variantId
                )
                stripeProductID = variant?.stripeProductID
              } else {
                stripeProductID = product.stripeProductID
              }

              if (!quantity) return null

              const isLast = index === (cart?.items?.length || 0) - 1

              const metaImage = meta?.image

              return (
                <Fragment key={index}>
                  <div className="">
                    <div className="relative">
                      {!metaImage && (
                        <span className="classes.placeholder">No image</span>
                      )}
                      {metaImage && typeof metaImage === 'object' && (
                        <Media
                          className=""
                          fill
                          imgClassName=""
                          resource={metaImage}
                        />
                      )}
                    </div>
                    <div className="">
                      {!stripeProductID && (
                        <p className="classes.warning">
                          {
                            'This product is not yet connected to Stripe. To link this product, '
                          }
                          <Link
                            href={`${process.env.NEXT_PUBLIC_SERVER_URL}/admin/collections/products/${id}`}
                          >
                            edit this product in the admin panel
                          </Link>
                          .
                        </p>
                      )}
                      <h6 className="">{title}</h6>

                      {product.price && (
                        <Price amount={product.price} currencyCode="usd" />
                      )}
                    </div>
                  </div>
                  {!isLast && <hr />}
                </Fragment>
              )
            }
            return null
          })}
          <div className="flex gap-2">
            <span>Order total:</span>{' '}
            <Price amount={cartTotal.amount} currencyCode="usd" />
          </div>
        </div>
      )}
    </div>
  )
}
