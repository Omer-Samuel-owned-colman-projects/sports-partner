import { Container, Typography, Box } from '@mui/material'

function App() {
  return (
    <Container maxWidth="md">
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <Typography variant="h3" component="h1" gutterBottom>
          Sports Partner
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Hello World
        </Typography>
      </Box>
    </Container>
  )
}

export default App
