- Use Nia deep research agent to help out with the following: 
# Error Type
Console AxiosError

## Error Message
Request failed with status code 400


    at async handleStartTrial (src/app/pricing/page.tsx:58:24)

## Code Frame
  56 |     try {
  57 |       setLoadingPlan(planCode);
> 58 |       const response = await authApiClient.post<{ authorization_url: string }>(
     |                        ^
  59 |         '/payment/start-trial',
  60 |         { planCode }
  61 |       );

Next.js version: 16.0.3 (Turbopack)


## Error Type
Console Error

## Error Message
API Error: 400 {}


    at <unknown> (src/lib/api/auth-client.ts:51:15)
    at async handleStartTrial (src/app/pricing/page.tsx:58:24)

## Code Frame
  49 |         }
  50 |       }
> 51 |       console.error('API Error:', error.response.status, error.response.data);
     |               ^
  52 |     } else if (error.request) {
  53 |       // Request made but no response
  54 |       console.error('Network Error:', error.message);

Next.js version: 16.0.3 (Turbopack)
right so um a couple things help me create a dashboard um in the help me create a progress tracker in the dashboard that dashboard page a progress tracker and also help me create a profile page right because there's already a button in the sidebar of a dashboard called um profile but like when you click on it it just gives you a 404 error page not found so create a um like a profile page maybe edit username stuff like edit username change password stuff like that and also uh on the pricing page the button like to start the free trial button when you click on it it doesn't work it doesn't do anything it doesn't work at all so obviously it should more or less take you to the um sign up thing like okay starting your sign up and all of that and it should the button should no longer say start seven day free trial rather it should say start 14 day free trial um and yeah all the like copy and everything should revolve should say 14 days not um seven day and always put no credit card required that's also very important you

Do this and do this well or I'll fire you!!!